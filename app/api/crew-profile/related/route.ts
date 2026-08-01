import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import {
  normalizeCrewDocumentStoragePath,
  signCrewDocumentRow,
  signCrewDocumentRows,
} from "../../../lib/crewDocumentStorage";
import {
  crewPortfolioBucket,
  normalizeCrewPortfolioStoragePath,
  signCrewPortfolioReference,
  signCrewPortfolioReferences,
} from "../../../lib/crewPortfolioStorage";
import { authenticateActiveBearer } from "../../../lib/activeBearerServer";
import { loadMarketplaceEntitlement } from "../../../lib/marketplaceEntitlementsServer";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import { getClientIp } from "../../../lib/turnstileServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxPayloadKeys = 40;
const maxDefaultTextLength = 1_000;
const maxLongTextLength = 10_000;
const maxUrlLength = 4_096;
const maximumRelatedRequestBytes = 64 * 1024;

type RelatedKind = "document" | "experience" | "reference" | "portfolio";
type RelatedAction = "save" | "delete" | "reorder";
const relatedActions = new Set<RelatedAction>(["save", "delete", "reorder"]);

const relatedTables: Record<RelatedKind, { table: string; columns: string[] }> = {
  document: {
    table: "crew_documents",
    columns: [
      "document_type",
      "category",
      "issuer",
      "issue_date",
      "expiry_date",
      "no_expiry",
      "show_on_cv",
      "file_url",
      "notes",
    ],
  },
  experience: {
    table: "crew_experiences",
    columns: ["yacht_name", "yacht_type", "yacht_program", "yacht_size", "location", "position", "start_date", "end_date", "description", "photo_url"],
  },
  reference: {
    table: "crew_references",
    columns: ["name", "role", "vessel", "company", "phone", "email", "notes", "show_on_cv"],
  },
  portfolio: {
    table: "crew_portfolio_photos",
    columns: ["title", "image_url", "location"],
  },
};

export async function GET(request: NextRequest) {
  const token = readBearerToken(request);
  const profileId = request.nextUrl.searchParams.get("profileId")?.trim();

  const rateLimit = consumeRequestRateLimit(
    `crew-related:get:${getClientIp(request) || "unknown"}`,
    120,
    60_000,
  );
  if (!rateLimit.allowed) {
    return jsonError(
      "Too many crew profile requests.",
      429,
      rateLimit.retryAfterSeconds,
    );
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Crew profile service is unavailable.", 500);
  }

  if (!token) {
    return jsonError("Login session is required.", 401);
  }

  if (!profileId || !isUuid(profileId)) {
    return jsonError("A valid crew profile id is required.", 400);
  }

  const clients = await getAuthorizedClients(token, profileId);
  if (!clients.ok) {
    return jsonError(clients.error, clients.status);
  }

  const { serviceClient } = clients;
  const [documentRes, experienceRes, referenceRes, portfolioRes] = await Promise.all([
    serviceClient
      .from("crew_documents")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(100),
    serviceClient
      .from("crew_experiences")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("start_date", { ascending: false })
      .limit(200),
    serviceClient
      .from("crew_references")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(100),
    serviceClient
      .from("crew_portfolio_photos")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const error = documentRes.error || experienceRes.error || referenceRes.error || portfolioRes.error;
  if (error) {
    return jsonError("Crew profile records could not be loaded.", 500);
  }

  const documents = await signCrewDocumentRows(
    serviceClient,
    documentRes.data || [],
    profileId,
    resolvedSupabaseUrl,
  );
  const experienceRows = experienceRes.data || [];
  const portfolioRows = portfolioRes.data || [];
  const signedMedia = await signCrewPortfolioReferences(
    serviceClient,
    [
      ...experienceRows.map((row) => row.photo_url),
      ...portfolioRows.map((row) => row.image_url),
    ],
    [profileId],
    resolvedSupabaseUrl,
  );
  const experiences = experienceRows.map((row, index) => ({
    ...row,
    photo_url: signedMedia[index] || "",
  }));
  const portfolio = portfolioRows.map((row, index) => ({
    ...row,
    image_url: signedMedia[experienceRows.length + index] || "",
  }));

  return jsonResponse({
    ok: true,
    documents,
    experiences,
    references: referenceRes.data || [],
    portfolio,
  });
}

export async function POST(request: NextRequest) {
  const token = readBearerToken(request);

  const rateLimit = consumeRequestRateLimit(
    `crew-related:post:${getClientIp(request) || "unknown"}`,
    60,
    60_000,
  );
  if (!rateLimit.allowed) {
    return jsonError(
      "Too many crew profile changes.",
      429,
      rateLimit.retryAfterSeconds,
    );
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Crew profile service is unavailable.", 500);
  }

  if (!token) {
    return jsonError("Login session is required.", 401);
  }

  // Authenticate before consuming a mutation body so unauthenticated callers
  // cannot spend server memory parsing arbitrary payloads.
  const authenticated = await getAuthenticatedClients(token);
  if (!authenticated.ok) {
    return jsonError(authenticated.error, authenticated.status);
  }

  const parsedBody = await readLimitedJsonObjectDetailed(
    request,
    maximumRelatedRequestBytes,
  );
  if (!parsedBody.ok) {
    return jsonError(
      parsedBody.error === "content-type"
        ? "The request must use JSON."
        : parsedBody.error === "too-large"
          ? "The crew profile request is too large."
          : "Invalid crew profile request.",
      parsedBody.error === "content-type"
        ? 415
        : parsedBody.error === "too-large"
          ? 413
          : 400,
    );
  }
  const body = parsedBody.value;

  const action = isRelatedAction(body.action) ? body.action : null;
  const kind = isRelatedKind(body.kind) ? body.kind : null;
  const profileId =
    typeof body.profileId === "string" ? body.profileId.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";

  if (
    !action ||
    !kind ||
    !isUuid(profileId) ||
    (body.id !== undefined && typeof body.id !== "string") ||
    (id && !isUuid(id)) ||
    (body.payload !== undefined && !isPlainRecord(body.payload))
  ) {
    return jsonError("Invalid crew profile request.", 400);
  }

  const clients = await authorizeProfileAccess(
    authenticated.user,
    authenticated.serviceClient,
    profileId,
  );
  if (!clients.ok) {
    return jsonError(clients.error, clients.status);
  }

  const { serviceClient } = clients;
  const config = relatedTables[kind];

  if (action === "reorder") {
    if (kind !== "portfolio" || !Array.isArray(body.items) || body.items.length > 200) {
      return jsonError("Invalid gallery order request.", 400);
    }

    const items = body.items.map((item) =>
      isPlainRecord(item)
        ? {
            id: typeof item.id === "string" ? item.id.trim() : "",
            location:
              typeof item.location === "string" ? item.location.trim() : "",
          }
        : { id: "", location: "" },
    );
    const ids = items.map((item) => item.id);
    if (
      ids.some((itemId) => !isUuid(itemId)) ||
      items.some((item) => item.location.length > maxDefaultTextLength) ||
      new Set(ids).size !== ids.length
    ) {
      return jsonError("Invalid gallery order request.", 400);
    }
    if (items.length === 0) return jsonResponse({ ok: true, data: [] });

    const { data: ownedPhotos, error: ownedPhotosError } = await serviceClient
      .from("crew_portfolio_photos")
      .select("id,title,image_url,location")
      .eq("crew_profile_id", profileId)
      .in("id", ids);

    if (ownedPhotosError) {
      return jsonError("Gallery order could not be saved.", 500);
    }
    if (!ownedPhotos || ownedPhotos.length !== ids.length) {
      return jsonError("Gallery photo access denied.", 403);
    }

    const locationById = new Map(items.map((item) => [item.id, item.location]));
    const rows = ownedPhotos.map((photo) => ({
      ...photo,
      crew_profile_id: profileId,
      location: locationById.get(photo.id) || "",
    }));
    const { data, error } = await serviceClient
      .from("crew_portfolio_photos")
      .upsert(rows, { onConflict: "id" })
      .select("*");

    if (error) return jsonError("Gallery order could not be saved.", 500);
    return jsonResponse({ ok: true, data: data || [] });
  }

  if (action === "delete") {
    if (!id) {
      return jsonError("Record id is required.", 400);
    }

    const mediaColumn =
      kind === "document"
        ? "file_url"
        : kind === "experience"
        ? "photo_url"
        : kind === "portfolio"
          ? "image_url"
          : "";
    const mediaRecord = mediaColumn
      ? await serviceClient
          .from(config.table)
          .select(mediaColumn)
          .eq("id", id)
          .eq("crew_profile_id", profileId)
          .maybeSingle()
      : null;

    if (mediaRecord?.error) {
      console.error("Crew media cleanup lookup failed", mediaRecord.error.message);
      return jsonError("Crew profile record could not be deleted.", 500);
    }
    if (mediaColumn && !mediaRecord?.data) {
      return jsonError("Crew profile record not found.", 404);
    }

    const { error, count } = await serviceClient
      .from(config.table)
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("crew_profile_id", profileId);

    if (error) return jsonError("Crew profile record could not be deleted.", 500);
    if (count !== 1) return jsonError("Crew profile record not found.", 404);

    if (mediaColumn && mediaRecord?.data) {
      const storagePath = normalizeRelatedMediaPath(
        kind,
        (mediaRecord.data as unknown as Record<string, unknown>)[mediaColumn],
        profileId,
      );
      if (storagePath) {
        await removeRelatedMedia(serviceClient, kind, storagePath);
      }
    }
    return jsonResponse({ ok: true });
  }

  const payload = cleanPayload(
    isPlainRecord(body.payload) ? body.payload : {},
    config.columns,
  );
  if (!payload) {
    return jsonError("Invalid crew profile record.", 400);
  }

  if (kind === "document" && Object.hasOwn(payload, "file_url")) {
    const storagePath = normalizeCrewDocumentStoragePath(
      payload.file_url,
      profileId,
      resolvedSupabaseUrl,
    );
    if (storagePath === null) {
      return jsonError("Invalid crew document file reference.", 400);
    }
    payload.file_url = storagePath;
  }

  const portfolioColumn =
    kind === "experience"
      ? "photo_url"
      : kind === "portfolio"
        ? "image_url"
        : "";
  if (portfolioColumn && Object.hasOwn(payload, portfolioColumn)) {
    const rawReference = payload[portfolioColumn];
    if (rawReference !== "" && rawReference !== null) {
      const storagePath = normalizeCrewPortfolioStoragePath(
        rawReference,
        [profileId],
        resolvedSupabaseUrl,
      );
      if (!storagePath) {
        return jsonError("Invalid crew portfolio file reference.", 400);
      }
      payload[portfolioColumn] = storagePath;
    }
  }

  const mediaColumn =
    kind === "document" ? "file_url" : portfolioColumn;
  let previousMediaPath = "";
  if (id && mediaColumn && Object.hasOwn(payload, mediaColumn)) {
    const previousMedia = await serviceClient
      .from(config.table)
      .select(mediaColumn)
      .eq("id", id)
      .eq("crew_profile_id", profileId)
      .maybeSingle();
    if (previousMedia.error) {
      console.error("Crew media replacement lookup failed", previousMedia.error.message);
      return jsonError("Crew profile record could not be saved.", 500);
    }
    if (!previousMedia.data) {
      return jsonError("Crew profile record not found.", 404);
    }
    previousMediaPath =
      normalizeRelatedMediaPath(
        kind,
        (previousMedia.data as unknown as Record<string, unknown>)[mediaColumn],
        profileId,
      ) || "";
  }

  const row = { ...payload, crew_profile_id: profileId };

  let response = id
    ? await serviceClient
        .from(config.table)
        .update(row)
        .eq("id", id)
        .eq("crew_profile_id", profileId)
        .select("*")
        .single()
    : await serviceClient.from(config.table).insert(row).select("*").single();

  if (response.error && kind === "experience" && /yacht_type|yacht_program|yacht_size|location|schema cache|column/i.test(response.error.message)) {
    const fallbackRow = encodeExperienceMetadataFallback(row);
    response = id
      ? await serviceClient
          .from(config.table)
          .update(fallbackRow)
          .eq("id", id)
          .eq("crew_profile_id", profileId)
          .select("*")
          .single()
      : await serviceClient.from(config.table).insert(fallbackRow).select("*").single();
  }

  if (response.error) {
    const rejectedMediaPath = mediaColumn
      ? normalizeRelatedMediaPath(kind, payload[mediaColumn], profileId) || ""
      : "";
    if (rejectedMediaPath && rejectedMediaPath !== previousMediaPath) {
      await removeRelatedMedia(serviceClient, kind, rejectedMediaPath);
    }
    const quotaOrValidationFailure =
      response.error.code === "23514" ||
      /row limit reached|bounded_payload_check/i.test(response.error.message);
    return jsonError(
      quotaOrValidationFailure
        ? "This crew profile section has reached its safe record or field limit."
        : "Crew profile record could not be saved.",
      quotaOrValidationFailure ? 409 : 500,
    );
  }

  const savedMediaPath = mediaColumn
    ? normalizeRelatedMediaPath(kind, response.data?.[mediaColumn], profileId) || ""
    : "";
  if (previousMediaPath && previousMediaPath !== savedMediaPath) {
    await removeRelatedMedia(serviceClient, kind, previousMediaPath);
  }

  let data = response.data;
  if (kind === "document") {
    data = await signCrewDocumentRow(
      serviceClient,
      response.data,
      profileId,
      resolvedSupabaseUrl,
    );
  } else if (portfolioColumn) {
    data = {
      ...response.data,
      [portfolioColumn]: await signCrewPortfolioReference(
        serviceClient,
        response.data[portfolioColumn],
        [profileId],
        resolvedSupabaseUrl,
      ),
    };
  }

  return jsonResponse({ ok: true, data });
}

function normalizeRelatedMediaPath(
  kind: RelatedKind,
  value: unknown,
  profileId: string,
) {
  if (kind === "document") {
    return normalizeCrewDocumentStoragePath(
      value,
      profileId,
      resolvedSupabaseUrl,
    );
  }
  if (kind === "experience" || kind === "portfolio") {
    return normalizeCrewPortfolioStoragePath(
      value,
      [profileId],
      resolvedSupabaseUrl,
    );
  }
  return null;
}

async function removeRelatedMedia(
  serviceClient: SupabaseClient,
  kind: RelatedKind,
  storagePath: string,
) {
  const bucket = kind === "document" ? "crew-documents" : crewPortfolioBucket;
  if (bucket === crewPortfolioBucket) {
    const locked = await serviceClient.rpc(
      "bluedeck_job_application_media_path_locked",
      { p_storage_path: storagePath },
    );
    if (locked.error) {
      console.error("Crew media retention check failed", locked.error.message);
      return;
    }
    if (locked.data === true) return;
  }

  const { error } = await serviceClient.storage.from(bucket).remove([storagePath]);
  if (error) {
    console.error("Crew media cleanup failed", error.message);
  }
}

function cleanPayload(payload: Record<string, unknown>, columns: string[]) {
  if (Object.keys(payload).length > maxPayloadKeys) return null;

  const result: Record<string, string | boolean | null> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!columns.includes(key) || value === undefined) continue;

    if (["no_expiry", "show_on_cv"].includes(key)) {
      if (typeof value !== "boolean") return null;
      result[key] = value;
      continue;
    }

    if (["issue_date", "expiry_date", "start_date", "end_date"].includes(key)) {
      if (value === "" || value === null) {
        result[key] = null;
        continue;
      }
      if (typeof value !== "string" || !isIsoDate(value)) return null;
      result[key] = value;
      continue;
    }

    if (value === null) {
      result[key] = null;
      continue;
    }
    if (typeof value !== "string") return null;

    const maxLength = textLimitForColumn(key);
    if (value.length > maxLength || value.includes("\0")) return null;
    result[key] = value;
  }

  return result;
}

const experienceMetadataPrefix = "__BLUDECK_EXPERIENCE_META__";

function encodeExperienceMetadataFallback(row: Record<string, unknown>) {
  const meta = {
    yacht_type: typeof row.yacht_type === "string" ? row.yacht_type.trim() : "",
    yacht_program: typeof row.yacht_program === "string" ? row.yacht_program.trim() : "",
    yacht_size: typeof row.yacht_size === "string" ? row.yacht_size.trim() : "",
    location: typeof row.location === "string" ? row.location.trim() : "",
  };
  const cleanDescription = stripExperienceMetadata(typeof row.description === "string" ? row.description : "");
  const fallbackRow = { ...row };
  delete fallbackRow.yacht_type;
  delete fallbackRow.yacht_program;
  delete fallbackRow.yacht_size;
  delete fallbackRow.location;

  if (meta.yacht_type || meta.yacht_program || meta.yacht_size || meta.location) {
    fallbackRow.description = `${experienceMetadataPrefix}${JSON.stringify(meta)}\n${cleanDescription}`;
  } else {
    fallbackRow.description = cleanDescription;
  }

  return fallbackRow;
}

function stripExperienceMetadata(value: string) {
  if (!value.startsWith(experienceMetadataPrefix)) return value;
  const lineBreak = value.indexOf("\n");
  return lineBreak === -1 ? "" : value.slice(lineBreak + 1);
}

async function getAuthorizedClients(token: string, profileId: string) {
  const authenticated = await getAuthenticatedClients(token);
  if (!authenticated.ok) return authenticated;
  return authorizeProfileAccess(
    authenticated.user,
    authenticated.serviceClient,
    profileId,
  );
}

async function getAuthenticatedClients(token: string) {
  const authClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authenticated = await authenticateActiveBearer({
    token,
    authClient,
    serviceClient,
  });
  if (!authenticated.ok) {
    return {
      ok: false as const,
      error: authenticated.error,
      status: authenticated.status,
    };
  }

  return { ok: true as const, user: authenticated.user, serviceClient };
}

async function authorizeProfileAccess(
  user: User,
  serviceClient: SupabaseClient,
  profileId: string,
) {
  const entitlementResult = await loadMarketplaceEntitlement(
    serviceClient,
    user.id,
  );
  if (!entitlementResult.ok) {
    return {
      ok: false as const,
      error: "Crew workspace access could not be verified.",
      status: 503,
    };
  }
  if (!entitlementResult.entitlement?.canUseCrewWorkspace) {
    return {
      ok: false as const,
      error: "Crew workspace access denied.",
      status: 403,
    };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("crew_profiles")
    .select("id,user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false as const,
      error: "Crew profile access could not be verified.",
      status: 500,
    };
  }

  if (profile?.user_id === null) {
    return {
      ok: false as const,
      error: "Crew profile identity must be reconciled before editing.",
      status: 409,
    };
  }

  if (!profile || profile.user_id !== user.id) {
    return { ok: false as const, error: "Crew profile access denied.", status: 403 };
  }

  return { ok: true as const, serviceClient };
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() || "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match || match[1].length > 8_192) return "";
  return match[1];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function isRelatedKind(value: unknown): value is RelatedKind {
  return typeof value === "string" && Object.hasOwn(relatedTables, value);
}

function isRelatedAction(value: unknown): value is RelatedAction {
  return (
    typeof value === "string" &&
    relatedActions.has(value as RelatedAction)
  );
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function textLimitForColumn(column: string) {
  if (["file_url", "image_url", "photo_url"].includes(column)) {
    return maxUrlLength;
  }
  if (["description", "notes"].includes(column)) return maxLongTextLength;
  return maxDefaultTextLength;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  retryAfterSeconds?: number,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...(retryAfterSeconds
        ? { "Retry-After": String(retryAfterSeconds) }
        : {}),
    },
  });
}

function jsonError(error: string, status: number, retryAfterSeconds?: number) {
  return jsonResponse({ ok: false, error }, status, retryAfterSeconds);
}
