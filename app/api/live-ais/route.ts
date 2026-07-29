import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  authenticatedEmployerClients,
  isUuid,
} from "../../lib/employerAccessServer";
import { fetchMarineTrafficVessel, normalizeMmsi } from "../../lib/marineTraffic";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";

const liveAisCacheTtlMs = 30_000;
const liveAisThrottleMs = 5_000;
const maxCachedVessels = 500;

type LiveAisPayload = {
  ok: true;
  source: string;
  vessels: Array<{
    id: string;
    mmsi: string;
    name: string;
    lat?: number | null;
    lon?: number | null;
    speed?: number | null;
    course?: number | null;
    heading?: number | null;
    type: string;
    destination?: string | null;
    eta?: string | null;
    risk: "normal";
  }>;
};

type CachedAisPayload = {
  expiresAt: number;
  payload: LiveAisPayload;
};

const liveAisCache = new Map<string, CachedAisPayload>();

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (
    !authorization?.startsWith("Bearer ") ||
    !authorization.slice("Bearer ".length).trim()
  ) {
    return aisError("Authentication required.", 401);
  }

  const { searchParams } = request.nextUrl;
  const mmsi = normalizeMmsi(searchParams.get("mmsi"));
  const yachtId = (searchParams.get("yachtId") || "").trim().toLowerCase();

  if (!mmsi) {
    return aisError("A valid 9-digit MMSI is required.", 400);
  }

  if (!isUuid(yachtId)) {
    return aisError("A valid yacht is required.", 400);
  }

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return aisError(
      clients.status === 401
        ? clients.error
        : "Live AIS is temporarily unavailable.",
      clients.status === 401 ? 401 : 503,
    );
  }

  const access = await verifyYachtAccess(
    clients.serviceClient,
    clients.user,
    yachtId,
  );
  if (!access.ok) return aisError(access.error, access.status);

  const now = Date.now();
  const cacheKey = `${yachtId}:${mmsi}`;
  const cached = liveAisCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return aisSuccess(cached.payload);
  }
  if (cached) liveAisCache.delete(cacheKey);

  const throttle = consumeRequestRateLimit(
    `live-ais:user:${clients.user.id}`,
    1,
    liveAisThrottleMs,
  );
  if (!throttle.allowed) {
    return NextResponse.json(
      {
        ok: false,
        source: "Maritime AIS",
        error: "Live AIS was refreshed recently. Please wait a moment.",
        vessels: [],
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(throttle.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const result = await fetchMarineTrafficVessel(mmsi);

    if (!result.ok) {
      if (result.status === 404) {
        return aisError(
          "Live AIS data is not currently available for this vessel.",
          404,
        );
      }

      return aisError("Live AIS is temporarily unavailable.", result.status === 503 ? 503 : 502);
    }

    const payload: LiveAisPayload = {
      ok: true,
      source: result.provider || result.vessel.provider || "Maritime AIS",
      vessels: [
        {
          id: result.vessel.mmsi,
          mmsi: result.vessel.mmsi,
          name: result.vessel.shipName || result.vessel.mmsi,
          lat: result.vessel.latitude,
          lon: result.vessel.longitude,
          speed: result.vessel.speedKnots,
          course: result.vessel.course,
          heading: result.vessel.heading,
          type: result.vessel.typeName || "Vessel",
          destination: result.vessel.destination,
          eta: result.vessel.eta || result.vessel.etaCalculated,
          risk: "normal",
        },
      ],
    };

    liveAisCache.set(cacheKey, {
      expiresAt: now + liveAisCacheTtlMs,
      payload,
    });
    trimLiveAisCache(now);

    return aisSuccess(payload);
  } catch {
    console.error("[live-ais]", {
      event: "provider_request_failed",
      yachtId,
      mmsi,
    });
    return aisError("Live AIS is temporarily unavailable.", 502);
  }
}

async function verifyYachtAccess(
  serviceClient: SupabaseClient,
  user: User,
  yachtId: string,
) {
  const yachtResponse = await serviceClient
    .from("yachts")
    .select("id,owner_id")
    .eq("id", yachtId)
    .maybeSingle();

  if (yachtResponse.error) {
    console.error("[live-ais]", {
      event: "yacht_lookup_failed",
      yachtId,
      userId: user.id,
    });
    return {
      ok: false as const,
      error: "Live AIS access could not be verified.",
      status: 503,
    };
  }

  if (!yachtResponse.data) {
    return { ok: false as const, error: "Yacht not found.", status: 404 };
  }

  if (yachtResponse.data.owner_id === user.id) return { ok: true as const };

  const membershipResponse = await serviceClient
    .from("yacht_crew_memberships")
    .select("status,invited_email,crew_profiles(user_id,email)")
    .eq("yacht_id", yachtId)
    .eq("status", "active");

  if (membershipResponse.error) {
    console.error("[live-ais]", {
      event: "membership_lookup_failed",
      yachtId,
      userId: user.id,
    });
    return {
      ok: false as const,
      error: "Live AIS access could not be verified.",
      status: 503,
    };
  }

  const normalizedUserEmail = normalizeEmail(user.email);
  const isActiveMember = (membershipResponse.data || []).some((membership) => {
    const profile = joinedProfile(membership.crew_profiles);
    return (
      profile?.user_id === user.id ||
      (Boolean(normalizedUserEmail) &&
        (normalizeEmail(profile?.email) === normalizedUserEmail ||
          normalizeEmail(membership.invited_email) === normalizedUserEmail))
    );
  });

  return isActiveMember
    ? { ok: true as const }
    : {
        ok: false as const,
        error: "You do not have access to this yacht.",
        status: 403,
      };
}

function joinedProfile(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const profile = candidate as Record<string, unknown>;
  return {
    user_id: typeof profile.user_id === "string" ? profile.user_id : "",
    email: typeof profile.email === "string" ? profile.email : "",
  };
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function aisSuccess(payload: LiveAisPayload) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=15",
      Vary: "Authorization",
    },
  });
}

function aisError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, source: "Maritime AIS", error, vessels: [] },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function trimLiveAisCache(now: number) {
  if (liveAisCache.size <= maxCachedVessels) return;

  for (const [key, cached] of liveAisCache) {
    if (cached.expiresAt <= now) liveAisCache.delete(key);
  }

  while (liveAisCache.size > maxCachedVessels) {
    const oldestKey = liveAisCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    liveAisCache.delete(oldestKey);
  }
}
