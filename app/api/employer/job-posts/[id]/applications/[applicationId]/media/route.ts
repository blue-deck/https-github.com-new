import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  hasEmployerApplicationMediaSigningSecret,
  employerApplicationMediaRevision,
  selectEmployerApplicationGallerySources,
  verifyEmployerApplicationMediaCapability,
  type EmployerApplicationMediaKind,
} from "../../../../../../../lib/jobApplicationMediaServer";
import { isUuid } from "../../../../../../../lib/employerAccessServer";
import {
  crewPortfolioProxySignedUrlLifetimeSeconds,
  signCrewPortfolioReference,
} from "../../../../../../../lib/crewPortfolioStorage";
import { safeOwnedPublicMediaUrl } from "../../../../../../../lib/publicCrewSafety";
import {
  hasExpectedRasterSignature,
  safeRasterImageContentTypes,
} from "../../../../../../../lib/imageSafetyServer";
import { consumeRequestRateLimit } from "../../../../../../../lib/requestRateLimitServer";
import { resolveSupabaseUrl } from "../../../../../../../lib/supabaseConfig";
import { getClientIp } from "../../../../../../../lib/turnstileServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maximumSourceBytes = 10 * 1024 * 1024;
const sourceTimeoutMilliseconds = 8_000;
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type RouteContext = {
  params: Promise<{ id: string; applicationId: string }>;
};

type MediaCapability = {
  jobPostId: string;
  applicationId: string;
  kind: EmployerApplicationMediaKind;
  slot: number | null;
  expiresAt: number;
  revision: string;
};

type ApplicationMediaRow = {
  applicant_user_id?: unknown;
  crew_profile_id?: unknown;
};

export async function GET(request: Request, context: RouteContext) {
  const rateLimit = consumeRequestRateLimit(
    `employer-application-media:${getClientIp(request) || "unknown"}`,
    240,
    10 * 60 * 1_000,
  );
  if (!rateLimit.allowed) {
    return mediaError(
      "Too many media requests.",
      429,
      rateLimit.retryAfterSeconds,
    );
  }

  const params = await context.params;
  const capability = mediaCapabilityFromRequest(request, params);
  if (!capability) return mediaError("Media not found.", 404);

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (
    !supabaseServiceRoleKey ||
    !supabaseUrl ||
    !hasEmployerApplicationMediaSigningSecret()
  ) {
    return mediaError("Media service is unavailable.", 503);
  }

  const serviceClient = createClient(
    resolveSupabaseUrl(supabaseUrl),
    supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: application, error: applicationError } = await serviceClient
    .from("job_applications")
    .select("applicant_user_id,crew_profile_id")
    .eq("id", capability.applicationId)
    .eq("job_post_id", capability.jobPostId)
    .maybeSingle<ApplicationMediaRow>();

  const applicantUserId = text(application?.applicant_user_id).toLowerCase();
  const crewProfileId = text(application?.crew_profile_id).toLowerCase();
  if (
    applicationError ||
    !application ||
    !isUuid(applicantUserId) ||
    !isUuid(crewProfileId)
  ) {
    return mediaError("Media not found.", 404);
  }

  const { data: snapshot, error: snapshotError } = await serviceClient
    .from("job_application_snapshots")
    .select("media_snapshot,captured_at,expires_at,purged_at")
    .eq("application_id", capability.applicationId)
    .is("purged_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (
    snapshotError ||
    !snapshot ||
    !isRecord(snapshot.media_snapshot) ||
    typeof snapshot.captured_at !== "string"
  ) {
    return mediaError("Media not found.", 404);
  }

  let source = "";
  if (capability.kind === "avatar") {
    source = safeOwnedPublicMediaUrl(
      snapshot.media_snapshot.avatar_source,
      [crewProfileId, applicantUserId],
    );
  } else {
    const selected = selectEmployerApplicationGallerySources(
      Array.isArray(snapshot.media_snapshot.gallery)
        ? snapshot.media_snapshot.gallery
        : [],
      capability.applicationId,
      [crewProfileId, applicantUserId],
    );
    source = capability.slot === null ? "" : selected[capability.slot] || "";
  }

  const safeSource = safeOwnedPublicMediaUrl(source, [
    crewProfileId,
    applicantUserId,
  ]);
  if (!safeSource) return mediaError("Media not found.", 404);
  const expectedRevision = employerApplicationMediaRevision(
    snapshot.captured_at,
    safeSource,
  );
  if (!expectedRevision || expectedRevision !== capability.revision) {
    return mediaError("Media not found.", 404);
  }

  const signedSource = await signCrewPortfolioReference(
    serviceClient,
    safeSource,
    [crewProfileId, applicantUserId],
    resolveSupabaseUrl(supabaseUrl),
    crewPortfolioProxySignedUrlLifetimeSeconds,
  );
  if (!signedSource) return mediaError("Media not found.", 404);

  return proxyMedia(signedSource, capability.kind);
}

function mediaCapabilityFromRequest(
  request: Request,
  params: { id: string; applicationId: string },
): MediaCapability | null {
  const requestUrl = new URL(request.url);
  const jobPostId = params.id.trim().toLowerCase();
  const applicationId = params.applicationId.trim().toLowerCase();
  if (!isUuid(jobPostId) || !isUuid(applicationId)) return null;

  const version = singleSearchValue(requestUrl.searchParams, "v");
  const kind = singleSearchValue(requestUrl.searchParams, "kind");
  const rawSlot = singleSearchValue(requestUrl.searchParams, "slot", true);
  const expires = singleSearchValue(requestUrl.searchParams, "expires");
  const token = singleSearchValue(requestUrl.searchParams, "token");
  const revision = singleSearchValue(requestUrl.searchParams, "revision");
  if (
    version === null ||
    kind === null ||
    rawSlot === null ||
    expires === null ||
    token === null ||
    revision === null ||
    (kind !== "avatar" && kind !== "gallery")
  ) {
    return null;
  }

  if (kind === "avatar" && rawSlot !== "") return null;
  if (kind === "gallery" && !/^[0-3]$/.test(rawSlot)) return null;

  return verifyEmployerApplicationMediaCapability({
    jobPostId,
    applicationId,
    kind,
    slot: kind === "gallery" ? Number(rawSlot) : undefined,
    expires,
    token,
    revision,
    version,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function singleSearchValue(
  searchParams: URLSearchParams,
  name: string,
  optional = false,
) {
  const values = searchParams.getAll(name);
  if (values.length === 0) return optional ? "" : null;
  return values.length === 1 ? values[0] : null;
}

async function proxyMedia(
  source: string,
  kind: EmployerApplicationMediaKind,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    sourceTimeoutMilliseconds,
  );

  try {
    const upstream = await fetch(transformedStorageSource(source, kind), {
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return mediaError("Media redirect rejected.", 502);
    }
    if (!upstream.ok) return mediaError("Media could not be loaded.", 502);

    const contentType = (upstream.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!safeRasterImageContentTypes.has(contentType)) {
      return mediaError("Unsupported media type.", 415);
    }

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maximumSourceBytes
    ) {
      return mediaError("Media is too large.", 413);
    }

    const sourceBytes = await readLimitedBody(upstream, maximumSourceBytes);
    if (!hasExpectedRasterSignature(sourceBytes, contentType)) {
      throw new MediaFormatError();
    }

    return new Response(sourceBytes, {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Length": String(sourceBytes.byteLength),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    if (error instanceof MediaSizeError) {
      return mediaError("Media is too large.", 413);
    }
    if (error instanceof MediaFormatError) {
      return mediaError("Invalid media data.", 415);
    }
    return mediaError("Media request failed.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function transformedStorageSource(
  source: string,
  kind: EmployerApplicationMediaKind,
) {
  const transformed = new URL(source);
  if (!transformed.pathname.includes("/storage/v1/object/sign/")) {
    throw new MediaFormatError();
  }
  transformed.pathname = transformed.pathname.replace(
    "/storage/v1/object/sign/",
    "/storage/v1/render/image/sign/",
  );
  transformed.searchParams.set("width", kind === "avatar" ? "320" : "960");
  transformed.searchParams.set("height", kind === "avatar" ? "320" : "960");
  transformed.searchParams.set("resize", kind === "avatar" ? "cover" : "contain");
  transformed.searchParams.set("quality", "82");
  return transformed.toString();
}

async function readLimitedBody(response: Response, limit: number) {
  if (!response.body) throw new MediaFormatError();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw new MediaSizeError();
    }
    chunks.push(value);
  }

  if (size === 0) throw new MediaFormatError();
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function mediaError(
  message: string,
  status: number,
  retryAfterSeconds?: number,
) {
  return new Response(message, {
    status,
    headers: {
      ...privateHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      ...(retryAfterSeconds
        ? { "Retry-After": String(retryAfterSeconds) }
        : {}),
    },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

class MediaSizeError extends Error {}
class MediaFormatError extends Error {}
