import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  hasEmployerApplicationMediaSigningSecret,
  selectEmployerApplicationGallerySources,
  verifyEmployerApplicationMediaCapability,
  type EmployerApplicationMediaKind,
} from "../../../../../../../lib/jobApplicationMediaServer";
import { isUuid } from "../../../../../../../lib/employerAccessServer";
import {
  crewPortfolioProxySignedUrlLifetimeSeconds,
  signCrewPortfolioReference,
} from "../../../../../../../lib/crewPortfolioStorage";
import { safePublicMediaUrl } from "../../../../../../../lib/publicCrewSafety";
import { resolveSupabaseUrl } from "../../../../../../../lib/supabaseConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maximumSourceBytes = 16 * 1024 * 1024;
const sourceTimeoutMilliseconds = 8_000;
const allowedSourceContentTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);
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
};

type ApplicationMediaRow = {
  applicant_user_id?: unknown;
  crew_profile_id?: unknown;
};

export async function GET(request: Request, context: RouteContext) {
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

  const { data: profile, error: profileError } = await serviceClient
    .from("crew_profiles")
    .select("id,user_id,profile_photo_url")
    .eq("id", crewProfileId)
    .eq("user_id", applicantUserId)
    .maybeSingle();
  if (profileError || !profile) {
    return mediaError("Media not found.", 404);
  }

  let source = "";
  if (capability.kind === "avatar") {
    source = safePublicMediaUrl(profile.profile_photo_url);
  } else {
    const { data: photos, error: photoError } = await serviceClient
      .from("crew_portfolio_photos")
      .select("id,image_url,created_at")
      .eq("crew_profile_id", crewProfileId)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (photoError) return mediaError("Media not found.", 404);

    const selected = selectEmployerApplicationGallerySources(
      photos || [],
      capability.applicationId,
      [crewProfileId, applicantUserId],
    );
    source = capability.slot === null ? "" : selected[capability.slot] || "";
  }

  const safeSource = safePublicMediaUrl(source);
  if (!safeSource) return mediaError("Media not found.", 404);

  const signedSource = await signCrewPortfolioReference(
    serviceClient,
    safeSource,
    [crewProfileId, applicantUserId],
    resolveSupabaseUrl(supabaseUrl),
    crewPortfolioProxySignedUrlLifetimeSeconds,
  );
  if (!signedSource) return mediaError("Media not found.", 404);

  return proxyMedia(signedSource);
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
  if (
    version === null ||
    kind === null ||
    rawSlot === null ||
    expires === null ||
    token === null ||
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
    version,
  });
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

async function proxyMedia(source: string) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    sourceTimeoutMilliseconds,
  );

  try {
    const upstream = await fetch(source, {
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
    if (!allowedSourceContentTypes.has(contentType)) {
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

function mediaError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      ...privateHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

class MediaSizeError extends Error {}
class MediaFormatError extends Error {}
