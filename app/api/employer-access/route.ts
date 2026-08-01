import { NextRequest } from "next/server";
import {
  isEmployerRole,
  isPlatformAdmin,
} from "../../lib/employerAccess";
import {
  authenticatedEmployerClients,
  cleanEmployerAccessNote,
  cleanText,
  employerAccessEntryFromRow,
  employerAccessSelect,
  isRecord,
  isUuid,
  logEmployerAccessError,
  type EmployerAccessDatabaseRow,
} from "../../lib/employerAccessServer";
import { readLimitedJsonObjectDetailed } from "../../lib/requestBodyServer";
import { privateNextResponse as NextResponse } from "../../lib/privateApiResponse";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";
import { getClientIp } from "../../lib/turnstileServer";

const maximumEmployerAccessRequestBytes = 8 * 1024;
const maximumOwnedYachtsPerAccount = 25;

type EmployerAccessRequestBody = {
  yachtId?: unknown;
  role?: unknown;
  note?: unknown;
};

type OwnedYacht = {
  id: string;
  name: string;
  model: string;
  flag: string;
};

export async function GET(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `employer-access:get:ip:${getClientIp(request) || "unknown"}`,
    180,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) {
    return rateLimitedResponse(ipLimit.retryAfterSeconds);
  }

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const userLimit = consumeRequestRateLimit(
    `employer-access:get:user:${clients.user.id}`,
    120,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) {
    return rateLimitedResponse(userLimit.retryAfterSeconds);
  }

  const [yachtsResponse, accessResponse, profileResponse] =
    await Promise.all([
      clients.serviceClient
        .from("yachts")
        .select("id,name,model,flag,owner_id")
        .eq("owner_id", clients.user.id)
        .order("created_at", { ascending: false })
        .limit(maximumOwnedYachtsPerAccount + 1),
      clients.serviceClient
        .from("employer_access")
        .select(employerAccessSelect)
        .eq("user_id", clients.user.id)
        .order("updated_at", { ascending: false })
        .limit(maximumOwnedYachtsPerAccount + 1),
      clients.serviceClient
        .from("profiles")
        .select("role")
        .eq("id", clients.user.id)
        .maybeSingle(),
    ]);

  if (yachtsResponse.error || accessResponse.error) {
    logEmployerAccessError(
      "applicant_workspace_load_failed",
      yachtsResponse.error || accessResponse.error,
      { actorUserId: clients.user.id },
    );
    return NextResponse.json(
      { ok: false, error: "Hiring access could not be loaded." },
      { status: 500 },
    );
  }

  if (profileResponse.error) {
    logEmployerAccessError(
      "applicant_profile_load_failed",
      profileResponse.error,
      { actorUserId: clients.user.id },
    );
  }

  if (
    (yachtsResponse.data || []).length > maximumOwnedYachtsPerAccount ||
    (accessResponse.data || []).length > maximumOwnedYachtsPerAccount
  ) {
    logEmployerAccessError(
      "applicant_workspace_resource_limit_exceeded",
      undefined,
      { actorUserId: clients.user.id },
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          "This account has more yacht records than the workspace can safely display. Contact BlueDeck support.",
      },
      { status: 409 },
    );
  }

  const ownedYachts = (yachtsResponse.data || [])
    .map(normalizeOwnedYacht)
    .filter((yacht): yacht is OwnedYacht => Boolean(yacht));
  const yachtsById = new Map(ownedYachts.map((yacht) => [yacht.id, yacht]));
  const accessByYacht = new Map<
    string,
    NonNullable<ReturnType<typeof employerAccessEntryFromRow>>
  >();

  for (const row of accessResponse.data || []) {
    const yacht = yachtsById.get(cleanText(row.yacht_id));
    const access = employerAccessEntryFromRow(row, yacht);
    if (!access) {
      logEmployerAccessError("invalid_employer_access_record", undefined, {
        actorUserId: clients.user.id,
        recordId: cleanText(row.id) || "unknown",
      });
      return NextResponse.json(
        { ok: false, error: "Hiring access could not be loaded." },
        { status: 500 },
      );
    }
    accessByYacht.set(access.yachtId, access);
  }

  const freshUser = clients.user;
  return NextResponse.json({
    ok: true,
    accountRole: normalizeAccountRole(
      profileResponse.data?.role || freshUser.user_metadata?.role,
    ),
    isAdmin: isPlatformAdmin(
      freshUser.app_metadata as Record<string, unknown>,
    ),
    yachts: ownedYachts.map((yacht) => ({
      ...yacht,
      access: accessByYacht.get(yacht.id) || null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `employer-access:post:ip:${getClientIp(request) || "unknown"}`,
    30,
    60 * 60 * 1_000,
  );
  if (!ipLimit.allowed) {
    return rateLimitedResponse(ipLimit.retryAfterSeconds);
  }

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const userLimit = consumeRequestRateLimit(
    `employer-access:post:user:${clients.user.id}`,
    10,
    60 * 60 * 1_000,
  );
  if (!userLimit.allowed) {
    return rateLimitedResponse(userLimit.retryAfterSeconds);
  }

  const parsedBody = await readLimitedJsonObjectDetailed(
    request,
    maximumEmployerAccessRequestBytes,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsedBody.error === "content-type"
            ? "The request must use JSON."
            : parsedBody.error === "too-large"
              ? "The employer access request is too large."
              : "Invalid employer access request.",
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
  const body: EmployerAccessRequestBody = parsedBody.value;

  const yachtId = cleanText(body.yachtId);
  const note = cleanEmployerAccessNote(body.note);

  if (!isUuid(yachtId) || !isEmployerRole(body.role)) {
    return NextResponse.json(
      { ok: false, error: "Select a yacht and your relationship to it." },
      { status: 400 },
    );
  }

  if (!note.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "The note must be text and no longer than 240 characters.",
      },
      { status: 400 },
    );
  }

  const { data: yacht, error: yachtError } = await clients.serviceClient
    .from("yachts")
    .select("id,name,model,owner_id")
    .eq("id", yachtId)
    .eq("owner_id", clients.user.id)
    .maybeSingle();

  if (yachtError) {
    logEmployerAccessError("applicant_yacht_lookup_failed", yachtError, {
      actorUserId: clients.user.id,
      yachtId,
    });
    return NextResponse.json(
      { ok: false, error: "The selected yacht could not be verified." },
      { status: 500 },
    );
  }

  if (!yacht) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Employer access can currently be requested only for a yacht registered to your account.",
      },
      { status: 403 },
    );
  }

  const { data: existingData, error: existingError } =
    await clients.serviceClient
      .from("employer_access")
      .select(employerAccessSelect)
      .eq("user_id", clients.user.id)
      .eq("yacht_id", yachtId)
      .maybeSingle();

  if (existingError) {
    logEmployerAccessError(
      "existing_employer_access_lookup_failed",
      existingError,
      { actorUserId: clients.user.id, yachtId },
    );
    return NextResponse.json(
      { ok: false, error: "Your request could not be saved. Please try again." },
      { status: 500 },
    );
  }

  const existingRow = existingData
    ? (existingData as EmployerAccessDatabaseRow)
    : null;
  const existingAccess = existingRow
    ? employerAccessEntryFromRow(existingRow, yacht)
    : null;

  if (existingRow && !existingAccess) {
    logEmployerAccessError("invalid_existing_employer_access_record", undefined, {
      actorUserId: clients.user.id,
      yachtId,
      recordId: cleanText(existingRow.id) || "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Your request could not be saved. Please try again." },
      { status: 500 },
    );
  }

  if (existingAccess?.status === "verified") {
    return NextResponse.json(
      { ok: false, error: "This yacht already has verified hiring access." },
      { status: 409 },
    );
  }

  if (existingAccess?.status === "pending") {
    return NextResponse.json(
      { ok: false, error: "This yacht already has a request under review." },
      { status: 409 },
    );
  }

  if (existingAccess?.status === "suspended") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Hiring access for this yacht is suspended. Contact BlueDeck support before requesting again.",
      },
      { status: 403 },
    );
  }

  const mutation = existingRow
    ? clients.serviceClient
        .from("employer_access")
        .update({
          requested_role: body.role,
          status: "pending",
          request_note: note.value || null,
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
        })
        .eq("id", existingRow.id)
        .eq("user_id", clients.user.id)
        .eq("status", "rejected")
        .eq("updated_at", existingRow.updated_at)
        .select(employerAccessSelect)
        .maybeSingle()
    : clients.serviceClient
        .from("employer_access")
        .insert({
          id: crypto.randomUUID(),
          user_id: clients.user.id,
          yacht_id: yachtId,
          requested_role: body.role,
          status: "pending",
          request_note: note.value || null,
        })
        .select(employerAccessSelect)
        .single();

  const { data: savedData, error: saveError } = await mutation;

  if (saveError) {
    const errorCode = cleanText(saveError.code);
    const duplicate = errorCode === "23505";
    const stateChanged = errorCode === "23514";
    logEmployerAccessError("employer_access_request_save_failed", saveError, {
      actorUserId: clients.user.id,
      yachtId,
      duplicate,
      stateChanged,
    });
    return NextResponse.json(
      {
        ok: false,
        error: duplicate
          ? "This yacht already has an employer access request."
          : stateChanged
            ? "The yacht or request changed while it was being saved. Refresh and try again."
          : "Your request could not be saved. Please try again.",
      },
      { status: duplicate || stateChanged ? 409 : 500 },
    );
  }

  if (!savedData) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This request changed while it was being saved. Refresh and try again.",
      },
      { status: 409 },
    );
  }

  const access = employerAccessEntryFromRow(savedData, yacht);
  if (!access) {
    logEmployerAccessError("invalid_saved_employer_access_record", undefined, {
      actorUserId: clients.user.id,
      yachtId,
      recordId: cleanText(savedData.id) || "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Your request could not be loaded after saving." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, access });
}

function normalizeAccountRole(value: unknown) {
  const role = cleanText(value).toLowerCase();
  return isEmployerRole(role) ? role : "crew";
}

function normalizeOwnedYacht(value: unknown): OwnedYacht | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id);
  if (!isUuid(id)) return null;

  return {
    id,
    name: cleanText(value.name) || "BlueDeck yacht",
    model: cleanText(value.model),
    flag: cleanText(value.flag),
  };
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Too many hiring access requests." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
