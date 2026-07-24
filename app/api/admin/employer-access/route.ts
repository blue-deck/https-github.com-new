import { NextRequest, NextResponse } from "next/server";
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
  isRecord,
  isUuid,
  logEmployerAccessError,
  type EmployerAccessDatabaseRow,
} from "../../../lib/employerAccessServer";

const databasePageSize = 1000;
const authPageSize = 1000;
const maximumInternalPages = 100;

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
  const clients = await adminEmployerClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const accessResult = await loadAllEmployerAccess(
    clients.serviceClient,
  );
  if ("error" in accessResult) {
    logEmployerAccessError(
      "administrator_queue_load_failed",
      accessResult.error,
      { actorUserId: clients.adminUser.id },
    );
    return NextResponse.json(
      { ok: false, error: "The employer review queue could not be loaded." },
      { status: accessResult.overflow ? 503 : 500 },
    );
  }

  const loadedAccess: LoadedAccess[] = [];
  for (const rawRow of accessResult.rows) {
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
  loadedAccess.sort(
    (first, second) =>
      Date.parse(second.access.updatedAt) -
        Date.parse(first.access.updatedAt) ||
      second.access.requestId.localeCompare(first.access.requestId),
  );

  const userIds = new Set(loadedAccess.map(({ row }) => row.user_id));
  const usersResult = await loadApplicantUsers(
    clients.serviceClient,
    userIds,
  );
  if ("error" in usersResult) {
    logEmployerAccessError(
      "administrator_applicant_accounts_load_failed",
      usersResult.error,
      { actorUserId: clients.adminUser.id },
    );
    return NextResponse.json(
      { ok: false, error: "The employer review queue could not be loaded." },
      { status: usersResult.overflow ? 503 : 500 },
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

  return NextResponse.json({ ok: true, requests });
}

export async function PATCH(request: NextRequest) {
  const clients = await adminEmployerClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  let body: ReviewBody;
  try {
    const value: unknown = await request.json();
    if (!isRecord(value)) throw new Error("Invalid JSON object");
    body = value;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid employer review request." },
      { status: 400 },
    );
  }

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

async function loadAllEmployerAccess(serviceClient: SupabaseClient) {
  const rows: unknown[] = [];
  let cursor = "";

  for (let page = 0; page < maximumInternalPages; page += 1) {
    let query = serviceClient
      .from("employer_access")
      .select(employerAccessWithYachtSelect)
      .order("id", { ascending: true })
      .limit(databasePageSize);
    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;

    if (error) return { error, overflow: false as const };

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < databasePageSize) {
      return { rows };
    }

    const nextCursor = cleanText(batch.at(-1)?.id);
    if (!isUuid(nextCursor) || nextCursor === cursor) {
      return {
        error: new Error("Employer access pagination cursor is invalid"),
        overflow: false as const,
      };
    }
    cursor = nextCursor;
  }

  return {
    error: new Error("Employer access internal page limit reached"),
    overflow: true as const,
  };
}

async function loadApplicantUsers(
  serviceClient: SupabaseClient,
  requestedUserIds: ReadonlySet<string>,
) {
  const users = new Map<string, User>();
  const remainingUserIds = new Set(requestedUserIds);
  if (remainingUserIds.size === 0) return { users };

  for (let page = 1; page <= maximumInternalPages; page += 1) {
    const { data, error } =
      await serviceClient.auth.admin.listUsers({
        page,
        perPage: authPageSize,
      });

    if (error) return { error, overflow: false as const };

    for (const user of data.users) {
      if (!remainingUserIds.has(user.id)) continue;
      users.set(user.id, user);
      remainingUserIds.delete(user.id);
    }

    if (
      remainingUserIds.size === 0 ||
      data.users.length < authPageSize
    ) {
      return { users };
    }
  }

  return {
    error: new Error("Auth user internal page limit reached"),
    overflow: true as const,
  };
}
