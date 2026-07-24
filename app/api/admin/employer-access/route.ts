import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import {
  employerAccessNoteLimit,
  isEmployerAccessStatus,
  isPlatformAdmin,
  readEmployerAccessMetadata,
  upsertEmployerAccessEntry,
  writeEmployerAccessMetadata,
  type EmployerAccessStatus,
} from "../../../lib/employerAccess";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReviewBody = {
  userId?: string;
  requestId?: string;
  status?: EmployerAccessStatus;
  note?: string;
};

export async function GET(request: NextRequest) {
  const clients = await adminClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } =
      await clients.serviceClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.error("Employer access queue could not be loaded", error);
      return NextResponse.json(
        { ok: false, error: "The employer review queue could not be loaded." },
        { status: 500 },
      );
    }

    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  const requests = users
    .flatMap((user) => employerRequestsForUser(user))
    .sort(
      (first, second) =>
        Date.parse(second.access.updatedAt || second.access.requestedAt) -
        Date.parse(first.access.updatedAt || first.access.requestedAt),
    );

  return NextResponse.json({ ok: true, requests });
}

export async function PATCH(request: NextRequest) {
  const clients = await adminClients(request);
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
    body = value as ReviewBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid employer review request." },
      { status: 400 },
    );
  }

  const userId = cleanText(body.userId);
  const requestId = cleanText(body.requestId);
  const reviewNote =
    cleanText(body.note).slice(0, employerAccessNoteLimit);

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

  const targetUserResponse =
    await clients.serviceClient.auth.admin.getUserById(userId);
  const targetUser = targetUserResponse.data.user;

  if (targetUserResponse.error) {
    console.error(
      "Employer access applicant could not be loaded",
      targetUserResponse.error,
    );
    return NextResponse.json(
      { ok: false, error: "The applicant account could not be loaded." },
      { status: 500 },
    );
  }

  if (!targetUser) {
    return NextResponse.json(
      { ok: false, error: "Applicant account could not be found." },
      { status: 404 },
    );
  }

  const currentMetadata = targetUser.app_metadata as Record<string, unknown>;
  const accessMetadata = readEmployerAccessMetadata(currentMetadata);
  const currentEntry = accessMetadata.entries.find(
    (entry) => entry.requestId === requestId,
  );

  if (!currentEntry) {
    return NextResponse.json(
      { ok: false, error: "Employer access request could not be found." },
      { status: 404 },
    );
  }

  if (!isAllowedTransition(currentEntry.status, body.status)) {
    return NextResponse.json(
      {
        ok: false,
        error: `This request cannot move from ${currentEntry.status} to ${body.status}.`,
      },
      { status: 409 },
    );
  }

  if (
    (body.status === "rejected" || body.status === "suspended") &&
    !reviewNote
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Add a short explanation before rejecting or suspending access.",
      },
      { status: 400 },
    );
  }

  let verifiedYacht:
    | { id: string; name: string | null; model: string | null }
    | null = null;

  if (body.status === "verified") {
    const { data: ownedYacht, error: yachtError } =
      await clients.serviceClient
        .from("yachts")
        .select("id,name,model,owner_id")
        .eq("id", currentEntry.yachtId)
        .eq("owner_id", userId)
        .maybeSingle();

    if (yachtError) {
      console.error(
        "Employer access yacht ownership could not be verified",
        yachtError,
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

    verifiedYacht = ownedYacht;
  }

  const now = new Date().toISOString();
  const nextEntry = {
    ...currentEntry,
    yachtName: verifiedYacht?.name || currentEntry.yachtName,
    yachtModel: verifiedYacht?.model || currentEntry.yachtModel,
    status: body.status,
    reviewNote,
    reviewedAt: now,
    reviewedBy: clients.adminUser.id,
    updatedAt: now,
  };
  const nextEntries = upsertEmployerAccessEntry(
    accessMetadata.entries,
    nextEntry,
  );

  const { error: updateError } =
    await clients.serviceClient.auth.admin.updateUserById(userId, {
      app_metadata: writeEmployerAccessMetadata(currentMetadata, nextEntries),
    });

  if (updateError) {
    console.error("Employer access review could not be saved", updateError);
    return NextResponse.json(
      { ok: false, error: "The review decision could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, access: nextEntry });
}

async function adminClients(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return {
      error: "Supabase is not configured.",
      status: 500,
    } as const;
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return { error: "Login session is required.", status: 401 } as const;
  }

  const resolvedUrl = resolveSupabaseUrl(supabaseUrl);
  const authClient = createClient(resolvedUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolvedUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);
  if (error || !user) {
    return { error: "Login session is invalid.", status: 401 } as const;
  }

  const freshAdminResponse = await serviceClient.auth.admin.getUserById(user.id);
  const adminUser = freshAdminResponse.data.user;

  if (freshAdminResponse.error) {
    console.error(
      "Employer access administrator could not be verified",
      freshAdminResponse.error,
    );
    return {
      error: "Platform administrator access could not be verified.",
      status: 500,
    } as const;
  }

  if (
    !adminUser ||
    !isPlatformAdmin(adminUser.app_metadata as Record<string, unknown>)
  ) {
    return { error: "Platform administrator access is required.", status: 403 } as const;
  }

  return { adminUser, serviceClient } as const;
}

function employerRequestsForUser(user: User) {
  const metadata = readEmployerAccessMetadata(
    user.app_metadata as Record<string, unknown>,
  );
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  return metadata.entries.map((access) => ({
    userId: user.id,
    applicantName: fullName || user.email || "BlueDeck account",
    applicantEmail: user.email || "",
    access,
  }));
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isAllowedTransition(
  current: EmployerAccessStatus,
  next: EmployerAccessStatus,
) {
  const transitions: Record<
    EmployerAccessStatus,
    EmployerAccessStatus[]
  > = {
    pending: ["verified", "rejected"],
    verified: ["suspended"],
    rejected: ["verified"],
    suspended: ["verified"],
  };

  return transitions[current].includes(next);
}
