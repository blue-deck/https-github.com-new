import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  employerAccessNoteLimit,
  isEmployerRole,
  isPlatformAdmin,
  readEmployerAccessMetadata,
  upsertEmployerAccessEntry,
  writeEmployerAccessMetadata,
  type EmployerAccessEntry,
  type EmployerRole,
} from "../../lib/employerAccess";
import { resolveSupabaseUrl } from "../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EmployerAccessRequestBody = {
  yachtId?: string;
  role?: EmployerRole;
  note?: string;
};

export async function GET(request: NextRequest) {
  const clients = await authenticatedClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  const [{ data: ownedYachts, error: yachtError }, { data: baseProfile }] =
    await Promise.all([
      clients.serviceClient
        .from("yachts")
        .select("id,name,model,flag,owner_id")
        .eq("owner_id", clients.user.id)
        .order("created_at", { ascending: false }),
      clients.serviceClient
        .from("profiles")
        .select("role")
        .eq("id", clients.user.id)
        .maybeSingle(),
    ]);

  if (yachtError) {
    console.error("Employer access yachts could not be loaded", yachtError);
    return NextResponse.json(
      { ok: false, error: "Your yachts could not be loaded." },
      { status: 500 },
    );
  }

  const freshUserResponse = await clients.serviceClient.auth.admin.getUserById(
    clients.user.id,
  );
  const freshUser = freshUserResponse.data.user;
  if (freshUserResponse.error) {
    console.error(
      "Employer access account could not be loaded",
      freshUserResponse.error,
    );
    return NextResponse.json(
      { ok: false, error: "Your account could not be loaded." },
      { status: 500 },
    );
  }

  if (!freshUser) {
    return NextResponse.json(
      { ok: false, error: "Account could not be loaded." },
      { status: 404 },
    );
  }

  const accessMetadata = readEmployerAccessMetadata(
    freshUser.app_metadata as Record<string, unknown>,
  );
  const accessByYacht = new Map(
    accessMetadata.entries.map((entry) => [entry.yachtId, entry]),
  );

  return NextResponse.json({
    ok: true,
    accountRole: normalizeAccountRole(
      baseProfile?.role || freshUser.user_metadata?.role,
    ),
    isAdmin: isPlatformAdmin(
      freshUser.app_metadata as Record<string, unknown>,
    ),
    yachts: (ownedYachts || []).map((yacht) => ({
      id: yacht.id,
      name: yacht.name || "BlueDeck yacht",
      model: yacht.model || "",
      flag: yacht.flag || "",
      access: accessByYacht.get(yacht.id) || null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const clients = await authenticatedClients(request);
  if ("error" in clients) {
    return NextResponse.json(
      { ok: false, error: clients.error },
      { status: clients.status },
    );
  }

  let body: EmployerAccessRequestBody;
  try {
    const value: unknown = await request.json();
    if (!isRecord(value)) throw new Error("Invalid JSON object");
    body = value as EmployerAccessRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid employer access request." },
      { status: 400 },
    );
  }

  const yachtId = cleanText(body.yachtId);
  const note = cleanText(body.note).slice(0, employerAccessNoteLimit);

  if (!isUuid(yachtId) || !isEmployerRole(body.role)) {
    return NextResponse.json(
      { ok: false, error: "Select a yacht and your relationship to it." },
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
    console.error("Employer access yacht could not be verified", yachtError);
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

  const freshUserResponse = await clients.serviceClient.auth.admin.getUserById(
    clients.user.id,
  );
  const freshUser = freshUserResponse.data.user;
  if (freshUserResponse.error) {
    console.error(
      "Employer access account could not be loaded",
      freshUserResponse.error,
    );
    return NextResponse.json(
      { ok: false, error: "Your account could not be loaded." },
      { status: 500 },
    );
  }

  if (!freshUser) {
    return NextResponse.json(
      { ok: false, error: "Account could not be loaded." },
      { status: 404 },
    );
  }

  const currentMetadata = freshUser.app_metadata as Record<string, unknown>;
  const accessMetadata = readEmployerAccessMetadata(currentMetadata);
  const existingEntry = accessMetadata.entries.find(
    (entry) => entry.yachtId === yachtId,
  );

  if (existingEntry?.status === "verified") {
    return NextResponse.json(
      { ok: false, error: "This yacht already has verified hiring access." },
      { status: 409 },
    );
  }

  if (existingEntry?.status === "pending") {
    return NextResponse.json(
      { ok: false, error: "This yacht already has a request under review." },
      { status: 409 },
    );
  }

  if (existingEntry?.status === "suspended") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Hiring access for this yacht is suspended. Contact BlueDeck support before requesting again.",
      },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const nextEntry: EmployerAccessEntry = {
    requestId: crypto.randomUUID(),
    yachtId,
    yachtName: yacht.name || "BlueDeck yacht",
    yachtModel: yacht.model || "",
    role: body.role,
    status: "pending",
    applicantNote: note,
    requestedAt: now,
    updatedAt: now,
    reviewedAt: "",
    reviewedBy: "",
    reviewNote: "",
  };
  const nextEntries = upsertEmployerAccessEntry(
    accessMetadata.entries,
    nextEntry,
  );

  const { error: updateError } =
    await clients.serviceClient.auth.admin.updateUserById(clients.user.id, {
      app_metadata: writeEmployerAccessMetadata(currentMetadata, nextEntries),
    });

  if (updateError) {
    console.error("Employer access request could not be saved", updateError);
    return NextResponse.json(
      { ok: false, error: "Your request could not be saved. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, access: nextEntry });
}

async function authenticatedClients(request: NextRequest) {
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

  return { user, serviceClient } as const;
}

function normalizeAccountRole(value: unknown) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return isEmployerRole(role) ? role : "crew";
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
