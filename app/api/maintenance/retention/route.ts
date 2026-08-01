import { randomUUID, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowedBuckets = new Set([
  "crew-documents",
  "crew-portfolio",
  "documents",
  "task-photos",
  "yacht-documents",
]);

type DeletionLease = {
  queue_id: number;
  bucket_id: string;
  object_name: string;
  lease_token: string;
};

export async function GET(request: NextRequest) {
  if (!hasValidCronAuthorization(request)) {
    return privateJson({ ok: false, error: "Unauthorized." }, 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return privateJson(
      { ok: false, error: "Maintenance is unavailable." },
      503,
    );
  }

  const serviceClient = createClient(
    resolveSupabaseUrl(supabaseUrl),
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const workerId = randomUUID();
  const drainDeadline = Date.now() + 45_000;
  let infrastructureFailures = 0;

  const databasePhase = await serviceClient.rpc(
    "bluedeck_run_retention_database_phase",
  );
  if (databasePhase.error) {
    infrastructureFailures += 1;
    logMaintenanceFailure("database_phase", databasePhase.error.code);
  }

  const storageDrain = await drainStorageDeletions(
    serviceClient,
    workerId,
    drainDeadline,
  );
  infrastructureFailures += storageDrain.infrastructureFailures;
  const signupDrain = await drainStaleSignups(serviceClient, drainDeadline);
  infrastructureFailures += signupDrain.infrastructureFailures;

  const queueHealth = await serviceClient.rpc(
    "bluedeck_storage_deletion_queue_health",
  );
  if (queueHealth.error) {
    infrastructureFailures += 1;
    logMaintenanceFailure("queue_health", queueHealth.error.code);
  }

  const failedQueueItems = readNonNegativeInteger(queueHealth.data, "failed");
  const workFailures =
    storageDrain.retrying + signupDrain.retrying + failedQueueItems;
  const healthy = infrastructureFailures === 0 && workFailures === 0;
  return privateJson(
    {
      ok: healthy,
      database: databasePhase.data || null,
      storage: {
        claimed: storageDrain.claimed,
        deleted: storageDrain.deleted,
        retrying: storageDrain.retrying,
      },
      accounts: {
        claimed: signupDrain.claimed,
        deleted: signupDrain.deleted,
        retrying: signupDrain.retrying,
      },
      queue: queueHealth.data || null,
    },
    healthy ? 200 : 503,
  );
}

async function drainStorageDeletions(
  serviceClient: SupabaseClient,
  workerId: string,
  deadline: number,
) {
  let claimed = 0;
  let deleted = 0;
  let infrastructureFailures = 0;

  for (let batch = 0; batch < 5 && Date.now() < deadline; batch += 1) {
    const claim = await serviceClient.rpc("bluedeck_claim_storage_deletions", {
      p_worker_id: workerId,
      p_limit: 100,
    });
    if (claim.error) {
      infrastructureFailures += 1;
      logMaintenanceFailure("storage_claim", claim.error.code);
      break;
    }
    const leases = Array.isArray(claim.data)
      ? (claim.data as DeletionLease[])
      : [];
    claimed += leases.length;
    const results = await mapWithConcurrency(leases, 6, async (lease) =>
      removeLeasedObject(serviceClient, lease),
    );
    deleted += results.filter(Boolean).length;
    if (leases.length < 100) break;
  }

  return {
    claimed,
    deleted,
    retrying: claimed - deleted,
    infrastructureFailures,
  };
}

async function drainStaleSignups(
  serviceClient: SupabaseClient,
  deadline: number,
) {
  let claimed = 0;
  let deleted = 0;
  let infrastructureFailures = 0;

  for (let batch = 0; batch < 5 && Date.now() < deadline; batch += 1) {
    const claim = await serviceClient.rpc(
      "bluedeck_claim_stale_signup_cleanup",
      {
        p_limit: 50,
      },
    );
    if (claim.error) {
      infrastructureFailures += 1;
      logMaintenanceFailure("signup_claim", claim.error.code);
      break;
    }
    const rawRows = Array.isArray(claim.data) ? claim.data : [];
    const userIds = rawRows
      .map((row) =>
        typeof row === "object" && row && "user_id" in row
          ? String(row.user_id)
          : "",
      )
      .filter(isUuid);
    if (userIds.length !== rawRows.length) infrastructureFailures += 1;
    claimed += userIds.length;
    const results = await mapWithConcurrency(userIds, 3, async (userId) => {
      try {
        const result = await serviceClient.auth.admin.deleteUser(userId, false);
        if (result.error) {
          logMaintenanceFailure(
            "signup_delete",
            String(result.error.status || "unknown"),
          );
          return false;
        }
        return true;
      } catch {
        logMaintenanceFailure("signup_delete", "network_error");
        return false;
      }
    });
    deleted += results.filter(Boolean).length;
    if (rawRows.length < 50) break;
  }

  return {
    claimed,
    deleted,
    retrying: claimed - deleted,
    infrastructureFailures,
  };
}

async function removeLeasedObject(
  serviceClient: SupabaseClient,
  lease: DeletionLease,
) {
  try {
    return await removeLeasedObjectUnchecked(serviceClient, lease);
  } catch {
    logMaintenanceFailure("storage_delete", "network_error");
    try {
      await finishDeletion(serviceClient, lease, false, "network_error");
    } catch {
      logMaintenanceFailure("storage_finish", "network_error");
    }
    return false;
  }
}

async function removeLeasedObjectUnchecked(
  serviceClient: SupabaseClient,
  lease: DeletionLease,
) {
  if (!isValidLease(lease)) {
    await finishDeletion(serviceClient, lease, false, "invalid_queue_record");
    return false;
  }

  const leaseState = await serviceClient.rpc(
    "bluedeck_storage_deletion_lease_state",
    {
      p_queue_id: lease.queue_id,
      p_lease_token: lease.lease_token,
    },
  );
  if (leaseState.error || leaseState.data === "invalid") {
    await finishDeletion(
      serviceClient,
      lease,
      false,
      "lease_state_unavailable",
    );
    return false;
  }
  if (leaseState.data === "gone" || leaseState.data === "replaced") {
    return finishDeletion(serviceClient, lease, true, "");
  }
  if (leaseState.data !== "current") {
    await finishDeletion(serviceClient, lease, false, "invalid_lease_state");
    return false;
  }

  const removal = await serviceClient.storage
    .from(lease.bucket_id)
    .remove([lease.object_name]);
  if (removal.error) {
    await finishDeletion(
      serviceClient,
      lease,
      false,
      storageErrorCode(removal.error),
    );
    return false;
  }

  const finalized = await finishDeletion(serviceClient, lease, true, "");
  if (finalized) return true;

  // A nominal Storage response is not enough: the database RPC verifies the
  // exact object row disappeared before acknowledging the outbox item.
  await finishDeletion(serviceClient, lease, false, "object_still_present");
  return false;
}

async function finishDeletion(
  serviceClient: SupabaseClient,
  lease: DeletionLease,
  succeeded: boolean,
  errorCode: string,
) {
  if (!Number.isSafeInteger(lease.queue_id) || !isUuid(lease.lease_token)) {
    return false;
  }
  const result = await serviceClient.rpc("bluedeck_finish_storage_deletion", {
    p_queue_id: lease.queue_id,
    p_lease_token: lease.lease_token,
    p_succeeded: succeeded,
    p_error_code: errorCode,
  });
  if (result.error) {
    logMaintenanceFailure("storage_finish", result.error.code);
    return false;
  }
  return result.data === true;
}

function hasValidCronAuthorization(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  if (
    !secret ||
    (process.env.NODE_ENV === "production" && secret.length < 32)
  ) {
    return false;
  }
  const authorization = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const providedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function isValidLease(value: DeletionLease) {
  return Boolean(
    value &&
    Number.isSafeInteger(value.queue_id) &&
    allowedBuckets.has(value.bucket_id) &&
    isUuid(value.lease_token) &&
    value.object_name.length >= 1 &&
    value.object_name.length <= 1024 &&
    !value.object_name.includes("..") &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value.object_name),
  );
}

function storageErrorCode(error: { statusCode?: string | number }) {
  const status = String(error.statusCode || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 32);
  return `storage_${status || "unknown"}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readNonNegativeInteger(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) return 0;
  const candidate = Number((value as Record<string, unknown>)[key]);
  return Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await operation(values[index]);
      }
    }),
  );
  return results;
}

function logMaintenanceFailure(stage: string, code: string | undefined) {
  console.error("BlueDeck maintenance step failed", {
    stage,
    code: code || "unknown",
  });
}

function privateJson(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
