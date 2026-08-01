import { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  isAllowedEmployerAccessTransition,
  isEmployerAccessStatus,
  type EmployerAccessStatus,
} from "../../../lib/employerAccess";
import {
  adminEmployerClients,
  cleanEmployerAccessNote,
  cleanText,
  employerAccessEntryFromRow,
  employerAccessSelect,
  employerAccessWithYachtSelect,
  isUuid,
  logEmployerAccessError,
  type EmployerAccessDatabaseRow,
} from "../../../lib/employerAccessServer";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { privateNextResponse as NextResponse } from "../../../lib/privateApiResponse";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { getClientIp } from "../../../lib/turnstileServer";

const administratorPageSize = 50;
const authLookupConcurrency = 5;
const maximumEmployerReviewRequestBytes = 8 * 1024;
const employerAccessStatuses: EmployerAccessStatus[] = [
  "pending",
  "verified",
  "rejected",
  "suspended",
];

type QueueFilter = "all" | EmployerAccessStatus;

type QueueCursor = {
  updatedAt: string;
  id: string;
};

type ReviewBody = {
  userId?: unknown;
  requestId?: unknown;
  status?: unknown;
  note?: unknown;
};

type LoadedAccess = {
  row: EmployerAccessDatabaseRow;
  access: NonNullable<ReturnType<typeof employerAccessEntryFromRow>>;
};

export async function GET(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `admin-employer-access:get:ip:${getClientIp(request) || "unknown"}`,
    180,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) {
    return rateLimitedResponse(ipLimit.retryAfterSeconds);
  }

  const clients = await adminEmployerClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const userLimit = consumeRequestRateLimit(
    `admin-employer-access:get:user:${clients.adminUser.id}`,
    120,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) {
    return rateLimitedResponse(userLimit.retryAfterSeconds);
  }

  const requestParameters = parseQueueRequest(request);
  if (!requestParameters.ok) {
    return NextResponse.json(
      { ok: false, error: "Invalid employer review queue request." },
      { status: 400 },
    );
  }

  let accessQuery = clients.serviceClient
    .from("employer_access")
    .select(employerAccessWithYachtSelect)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(administratorPageSize + 1);

  if (requestParameters.filter !== "all") {
    accessQuery = accessQuery.eq("status", requestParameters.filter);
  }
  if (requestParameters.cursor) {
    const { updatedAt, id } = requestParameters.cursor;
    accessQuery = accessQuery.or(
      `updated_at.lt.${updatedAt},and(updated_at.eq.${updatedAt},id.lt.${id})`,
    );
  }

  const [accessResult, countsResult] = await Promise.all([
    accessQuery,
    loadEmployerAccessCounts(clients.serviceClient),
  ]);
  if (accessResult.error || "error" in countsResult) {
    logEmployerAccessError(
      "administrator_queue_load_failed",
      accessResult.error || countsResult.error,
      { actorUserId: clients.adminUser.id },
    );
    return NextResponse.json(
      { ok: false, error: "The employer review queue could not be loaded." },
      { status: 500 },
    );
  }

  const rawRows = accessResult.data || [];
  const hasMore = rawRows.length > administratorPageSize;
  const loadedAccess: LoadedAccess[] = [];
  for (const rawRow of rawRows.slice(0, administratorPageSize)) {
    const row = rawRow as EmployerAccessDatabaseRow;
    const access = employerAccessEntryFromRow(row);
    if (!access || !isUuid(cleanText(row.user_id))) {
      logEmployerAccessError("invalid_administrator_queue_record", undefined, {
        actorUserId: clients.adminUser.id,
        recordId: cleanText(row.id) || "unknown",
      });
      return NextResponse.json(
        { ok: false, error: "The employer review queue could not be loaded." },
        { status: 500 },
      );
    }
    loadedAccess.push({ row, access });
  }

  const userIds = new Set(loadedAccess.map(({ row }) => row.user_id));
  const usersResult = await loadApplicantUsersById(
    clients.serviceClient,
    userIds,
  );
  for (const failure of usersResult.failures) {
    logEmployerAccessError(
      "administrator_applicant_account_lookup_failed",
      failure.error,
      {
        actorUserId: clients.adminUser.id,
        applicantUserId: failure.userId,
      },
    );
  }

  const requests = loadedAccess.map(({ row, access }) => {
    const user = usersResult.users.get(row.user_id);
    const applicantEmail = user?.email || "";
    const fullName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";

    return {
      userId: row.user_id,
      applicantName: fullName || applicantEmail || "BlueDeck account",
      applicantEmail,
      access,
    };
  });

  const lastRow = loadedAccess.at(-1)?.row;
  const nextCursor =
    hasMore && lastRow
      ? encodeQueueCursor({ updatedAt: lastRow.updated_at, id: lastRow.id })
      : "";
  const total =
    requestParameters.filter === "all"
      ? countsResult.counts.all
      : countsResult.counts[requestParameters.filter];

  return NextResponse.json({
    ok: true,
    requests,
    counts: countsResult.counts,
    total,
    hasMore,
    nextCursor,
  });
}

export async function PATCH(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `admin-employer-access:patch:ip:${getClientIp(request) || "unknown"}`,
    60,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) {
    return rateLimitedResponse(ipLimit.retryAfterSeconds);
  }

  const clients = await adminEmployerClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const userLimit = consumeRequestRateLimit(
    `admin-employer-access:patch:user:${clients.adminUser.id}`,
    40,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) {
    return rateLimitedResponse(userLimit.retryAfterSeconds);
  }

  const parsedBody = await readLimitedJsonObjectDetailed(
    request,
    maximumEmployerReviewRequestBytes,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsedBody.error === "content-type"
            ? "The request must use JSON."
            : parsedBody.error === "too-large"
              ? "The employer review request is too large."
              : "Invalid employer review request.",
      },
      {
        status:
          parsedBody.error === "content-type"
            ? 415
            : parsedBody.error === "too-large"
              ? 413
              : 400,
      },
    );
  }
  const body: ReviewBody = parsedBody.value;

  const userId = cleanText(body.userId);
  const requestId = cleanText(body.requestId);
  const reviewNote = cleanEmployerAccessNote(body.note);

  if (
    !isUuid(userId) ||
    !isUuid(requestId) ||
    !isEmployerAccessStatus(body.status) ||
    body.status === "pending"
  ) {
    return NextResponse.json(
      { ok: false, error: "Select a valid employer access decision." },
      { status: 400 },
    );
  }

  if (!reviewNote.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "The note must be text and no longer than 240 characters.",
      },
      { status: 400 },
    );
  }

  const nextStatus: EmployerAccessStatus = body.status;
  const { data: currentData, error: currentError } =
    await clients.serviceClient
      .from("employer_access")
      .select(employerAccessWithYachtSelect)
      .eq("id", requestId)
      .eq("user_id", userId)
      .maybeSingle();

  if (currentError) {
    logEmployerAccessError(
      "administrator_request_lookup_failed",
      currentError,
      {
        actorUserId: clients.adminUser.id,
        applicantUserId: userId,
        recordId: requestId,
      },
    );
    return NextResponse.json(
      { ok: false, error: "Employer access request could not be loaded." },
      { status: 500 },
    );
  }

  if (!currentData) {
    return NextResponse.json(
      { ok: false, error: "Employer access request could not be found." },
      { status: 404 },
    );
  }

  const currentRow = currentData as EmployerAccessDatabaseRow;
  const currentAccess = employerAccessEntryFromRow(currentRow);
  if (!currentAccess) {
    logEmployerAccessError("invalid_review_record", undefined, {
      actorUserId: clients.adminUser.id,
      applicantUserId: userId,
      recordId: requestId,
    });
    return NextResponse.json(
      { ok: false, error: "Employer access request could not be loaded." },
      { status: 500 },
    );
  }

  if (
    !isAllowedEmployerAccessTransition(currentAccess.status, nextStatus)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This request changed or cannot be updated in its current state. Refresh and try again.",
      },
      { status: 409 },
    );
  }

  if (
    (nextStatus === "rejected" || nextStatus === "suspended") &&
    !reviewNote.value
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Add a short explanation before rejecting or suspending access.",
      },
      { status: 400 },
    );
  }

  let yachtForResponse = {
    name: currentAccess.yachtName,
    model: currentAccess.yachtModel,
  };

  if (nextStatus === "verified") {
    const { data: ownedYacht, error: yachtError } =
      await clients.serviceClient
        .from("yachts")
        .select("id,name,model,owner_id")
        .eq("id", currentAccess.yachtId)
        .eq("owner_id", userId)
        .maybeSingle();

    if (yachtError) {
      logEmployerAccessError(
        "administrator_yacht_ownership_lookup_failed",
        yachtError,
        {
          actorUserId: clients.adminUser.id,
          applicantUserId: userId,
          yachtId: currentAccess.yachtId,
        },
      );
      return NextResponse.json(
        { ok: false, error: "Yacht ownership could not be verified." },
        { status: 500 },
      );
    }

    if (!ownedYacht) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Approval stopped because this yacht is no longer registered to the applicant.",
        },
        { status: 409 },
      );
    }

    yachtForResponse = {
      name: cleanText(ownedYacht.name) || "BlueDeck yacht",
      model: cleanText(ownedYacht.model),
    };
  }

  const { data: savedData, error: saveError } =
    await clients.serviceClient
      .from("employer_access")
      .update({
        status: nextStatus,
        review_note: reviewNote.value || null,
        reviewed_by: clients.adminUser.id,
      })
      .eq("id", requestId)
      .eq("user_id", userId)
      .eq("status", currentAccess.status)
      .eq("updated_at", currentRow.updated_at)
      .select(employerAccessSelect)
      .maybeSingle();

  if (saveError) {
    const stateChanged = cleanText(saveError.code) === "23514";
    logEmployerAccessError(
      "administrator_review_save_failed",
      saveError,
      {
        actorUserId: clients.adminUser.id,
        applicantUserId: userId,
        recordId: requestId,
      },
    );
    return NextResponse.json(
      {
        ok: false,
        error: stateChanged
          ? "The request or yacht ownership changed. Refresh and try again."
          : "The review decision could not be saved.",
      },
      { status: stateChanged ? 409 : 500 },
    );
  }

  if (!savedData) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This request changed while it was being reviewed. Refresh and try again.",
      },
      { status: 409 },
    );
  }

  const access = employerAccessEntryFromRow(savedData, yachtForResponse);
  if (!access) {
    logEmployerAccessError("invalid_saved_review_record", undefined, {
      actorUserId: clients.adminUser.id,
      applicantUserId: userId,
      recordId: requestId,
    });
    return NextResponse.json(
      { ok: false, error: "The saved review could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, access });
}

function parseQueueRequest(request: NextRequest) {
  const parameters = request.nextUrl.searchParams;
  if (
    Array.from(parameters.keys()).some(
      (key) => key !== "status" && key !== "cursor",
    ) ||
    parameters.getAll("status").length > 1 ||
    parameters.getAll("cursor").length > 1
  ) {
    return { ok: false as const };
  }

  const rawFilter = cleanText(parameters.get("status") || "pending");
  const filter: QueueFilter | null =
    rawFilter === "all"
      ? "all"
      : isEmployerAccessStatus(rawFilter)
        ? rawFilter
        : null;
  const rawCursor = parameters.get("cursor") || "";
  const cursor = rawCursor ? decodeQueueCursor(rawCursor) : null;
  if (!filter || (rawCursor && !cursor)) return { ok: false as const };

  return { ok: true as const, filter, cursor };
}

async function loadEmployerAccessCounts(serviceClient: SupabaseClient) {
  const results = await Promise.all(
    employerAccessStatuses.map((status) =>
      serviceClient
        .from("employer_access")
        .select("id", { count: "exact", head: true })
        .eq("status", status),
    ),
  );
  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) return { error: failedResult.error };

  const counts = {
    all: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    suspended: 0,
  };
  employerAccessStatuses.forEach((status, index) => {
    counts[status] = results[index].count || 0;
    counts.all += counts[status];
  });
  return { counts };
}

async function loadApplicantUsersById(
  serviceClient: SupabaseClient,
  requestedUserIds: ReadonlySet<string>,
) {
  const users = new Map<string, User>();
  const failures: Array<{ userId: string; error: unknown }> = [];
  const userIds = Array.from(requestedUserIds);

  for (let offset = 0; offset < userIds.length; offset += authLookupConcurrency) {
    const batch = userIds.slice(offset, offset + authLookupConcurrency);
    const results = await Promise.all(
      batch.map(async (userId) => ({
        userId,
        response: await serviceClient.auth.admin.getUserById(userId),
      })),
    );
    for (const { userId, response } of results) {
      if (response.error || !response.data.user) {
        failures.push({
          userId,
          error: response.error || new Error("Auth user is unavailable"),
        });
        continue;
      }
      users.set(userId, response.data.user);
    }
  }

  return { users, failures };
}

function encodeQueueCursor(cursor: QueueCursor) {
  return Buffer.from(
    JSON.stringify({
      updatedAt: normalizeCursorTimestamp(cursor.updatedAt),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeQueueCursor(value: string): QueueCursor | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      Object.keys(parsed).length !== 2 ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !isUuid(parsed.id)
    ) {
      return null;
    }
    const updatedAt = normalizeCursorTimestamp(parsed.updatedAt);
    return updatedAt ? { updatedAt, id: parsed.id } : null;
  } catch {
    return null;
  }
}

function normalizeCursorTimestamp(value: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "";
  return new Date(milliseconds).toISOString();
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Too many employer review requests." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
