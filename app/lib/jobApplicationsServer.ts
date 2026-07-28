import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
  isRecord,
  isUuid,
} from "./employerAccessServer";
import {
  isJobApplicationStatus,
  type EmployerJobApplication,
  type JobApplicationJobSummary,
  type OwnJobApplication,
} from "./jobApplications";
import {
  crewDiscoveryNotesPrefix,
  parseCrewDiscoverySettings,
} from "./crewDiscovery";
import {
  isJobClosureReason,
  isJobPostStatus,
  isSupportedJobListingNumber,
} from "./jobPosts";
import {
  safePublicMediaUrl,
  publicStructuredProfileField,
  publicStructuredStringArray,
} from "./publicCrewSafety";

export const maximumApplicationRequestBytes = 8_192;
export const maximumCoverNoteLength = 2_000;
export const ownJobApplicationSelect =
  "id,job_post_id,status,cover_note,submitted_at,status_changed_at,withdrawn_at,updated_at,version";

export type ApplicationCandidatePreview = {
  profilePhotoUrl: string;
  currentPosition: string;
  location: string;
  nationality: string;
  seekingPositions: string[];
  availabilityStatus: string;
  availableFrom: string;
};

type CandidatePreviewResult =
  | { ok: true; previews: Map<string, ApplicationCandidatePreview> }
  | { ok: false; error: string };

export function authenticatedApplicationClients(request: NextRequest) {
  return authenticatedEmployerClients(request);
}

export async function readApplicationBody(
  request: NextRequest,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, error: "The request must use JSON.", status: 415 };
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumApplicationRequestBytes
  ) {
    return { ok: false, error: "The request is too large.", status: 413 };
  }

  try {
    const text = await request.text();
    if (
      new TextEncoder().encode(text).byteLength > maximumApplicationRequestBytes
    ) {
      return { ok: false, error: "The request is too large.", status: 413 };
    }
    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) {
      return { ok: false, error: "The request must be an object.", status: 400 };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, error: "The request contains invalid JSON.", status: 400 };
  }
}

export function coverNoteFromBody(value: Record<string, unknown>) {
  if (Object.keys(value).some((key) => key !== "coverNote")) {
    return { ok: false as const, error: "The request contains unsupported fields." };
  }
  if (value.coverNote !== undefined && typeof value.coverNote !== "string") {
    return { ok: false as const, error: "The application note is invalid." };
  }

  const coverNote = cleanText(value.coverNote);
  if (coverNote.length > maximumCoverNoteLength) {
    return { ok: false as const, error: "The application note is too long." };
  }
  return { ok: true as const, coverNote };
}

export async function accountRole(
  serviceClient: SupabaseClient,
  userId: string,
) {
  const { data, error } = await serviceClient
    .from("marketplace_entitlements")
    .select("account_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logJobApplicationError("account_role_lookup_failed", error, {
      actorUserId: userId,
    });
    return { ok: false as const, role: "" };
  }

  return {
    ok: true as const,
    role: cleanText(data?.account_role).toLowerCase(),
  };
}

export async function canApplyToJob(
  serviceClient: SupabaseClient,
  userId: string,
  jobPostId: string,
) {
  const { data, error } = await serviceClient.rpc(
    "bluedeck_can_apply_to_job",
    {
      p_actor_user_id: userId,
      p_job_post_id: jobPostId,
    },
  );

  if (error) {
    logJobApplicationError("application_authority_lookup_failed", error, {
      actorUserId: userId,
      jobPostId,
    });
    return { ok: false as const, error: "Application access could not be verified." };
  }

  return { ok: true as const, allowed: data === true };
}

export async function canManageJobApplications(
  serviceClient: SupabaseClient,
  userId: string,
  jobPostId: string,
) {
  const { data, error } = await serviceClient.rpc(
    "bluedeck_can_manage_job",
    {
      p_actor_user_id: userId,
      p_job_post_id: jobPostId,
    },
  );

  if (error) {
    logJobApplicationError("application_manager_authority_lookup_failed", error, {
      actorUserId: userId,
      jobPostId,
    });
    return { ok: false as const, error: "Hiring access could not be verified." };
  }

  return { ok: true as const, allowed: data === true };
}

export async function listAuthorizedJobApplications(
  serviceClient: SupabaseClient,
  userId: string,
  jobPostId: string,
) {
  const { data, error } = await serviceClient.rpc(
    "bluedeck_list_job_applications",
    {
      p_actor_user_id: userId,
      p_job_post_id: jobPostId,
    },
  );

  if (error) {
    const forbidden = cleanText(error.code) === "42501";
    if (!forbidden) {
      logJobApplicationError("authorized_application_list_failed", error, {
        actorUserId: userId,
        jobPostId,
      });
    }
    return {
      ok: false as const,
      forbidden,
      error: "Applications could not be loaded.",
    };
  }

  return {
    ok: true as const,
    rows: Array.isArray(data) ? data : [],
  };
}

export async function loadApplicationCandidatePreviews(
  serviceClient: SupabaseClient,
  rows: unknown[],
): Promise<CandidatePreviewResult> {
  const applicantUserIds = new Set<string>();

  for (const value of rows) {
    if (!isRecord(value)) {
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }
    const applicantUserId = cleanText(value.applicant_user_id);
    if (!isUuid(applicantUserId)) {
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }
    applicantUserIds.add(applicantUserId);
  }

  const previews = new Map<string, ApplicationCandidatePreview>();
  const userIds = [...applicantUserIds];

  for (let index = 0; index < userIds.length; index += 100) {
    const batch = userIds.slice(index, index + 100);
    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select(
        "user_id,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,notes,created_at",
      )
      .in("user_id", batch)
      .order("created_at", { ascending: true });

    if (error) {
      logJobApplicationError("candidate_preview_load_failed", error, {
        candidateCount: batch.length,
      });
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }

    for (const row of data || []) {
      const userId = cleanText(row.user_id);
      if (!isUuid(userId) || previews.has(userId)) continue;
      const discoveryNotes =
        typeof row.notes === "string" ? row.notes.trim() : "";
      const hasSavedDiscoverySettings = discoveryNotes.startsWith(
        crewDiscoveryNotesPrefix,
      );
      const discovery = parseCrewDiscoverySettings(discoveryNotes);

      previews.set(userId, {
        profilePhotoUrl: safePublicMediaUrl(row.profile_photo_url),
        currentPosition:
          publicStructuredStringArray(row.current_positions, 1, 120)[0] ||
          publicStructuredProfileField(row.current_position, 120),
        location: publicStructuredProfileField(row.location, 120),
        nationality: publicStructuredProfileField(row.nationality, 80),
        seekingPositions: publicStructuredStringArray(
          row.seeking_positions,
          3,
          120,
        ),
        availabilityStatus: hasSavedDiscoverySettings
          ? discovery.availabilityStatus
          : "",
        availableFrom: candidateAvailabilityDate(discovery.availableFrom),
      });
    }
  }

  return { ok: true, previews };
}

export function applicationApplicantUserId(value: unknown) {
  if (!isRecord(value)) return "";
  const applicantUserId = cleanText(value.applicant_user_id);
  return isUuid(applicantUserId) ? applicantUserId : "";
}

export function ownJobApplicationFromRow(value: unknown): OwnJobApplication | null {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id);
  const jobPostId = cleanText(value.job_post_id);
  const status = value.status;
  const submittedAt = databaseTimestamp(value.submitted_at);
  const updatedAt = databaseTimestamp(value.updated_at);
  const withdrawnAt = optionalDatabaseTimestamp(value.withdrawn_at);
  const version = value.version;

  if (
    !isUuid(id) ||
    !isUuid(jobPostId) ||
    !isJobApplicationStatus(status) ||
    !submittedAt ||
    !updatedAt ||
    withdrawnAt === undefined ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    return null;
  }

  return {
    id,
    jobPostId,
    status,
    coverNote: cleanText(value.cover_note).slice(0, maximumCoverNoteLength),
    submittedAt,
    updatedAt,
    withdrawnAt,
    version,
  };
}

export function employerJobApplicationFromRow(
  value: unknown,
  preview?: ApplicationCandidatePreview,
): EmployerJobApplication | null {
  const application = ownJobApplicationFromRow(value);
  if (!application || !isRecord(value)) return null;

  const applicantRole = cleanText(value.applicant_role).toLowerCase();
  const applicantUserId = cleanText(value.applicant_user_id);
  if (
    (applicantRole !== "crew" && applicantRole !== "captain") ||
    !isUuid(applicantUserId)
  ) {
    return null;
  }

  const fullName =
    publicStructuredProfileField(value.applicant_name_snapshot, 120) ||
    "BlueDeck candidate";
  const currentPosition = publicStructuredProfileField(
    value.applicant_position_snapshot,
    120,
  );

  return {
    ...application,
    coverNote: "",
    applicantRole,
    privateNoteAvailable: Boolean(application.coverNote),
    candidate: {
      fullName,
      profilePhotoUrl: preview?.profilePhotoUrl || "",
      currentPosition: preview?.currentPosition || currentPosition,
      location: preview?.location || "",
      nationality: preview?.nationality || "",
      seekingPositions: preview?.seekingPositions || [],
      availabilityStatus: preview?.availabilityStatus || "",
      availableFrom: preview?.availableFrom || "",
    },
  };
}

export function jobApplicationSummaryFromRow(
  value: unknown,
): JobApplicationJobSummary | null {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id);
  const listingNumber = cleanText(value.listing_number);
  const status = cleanText(value.status);
  const closesAt = optionalDatabaseTimestamp(value.closes_at);
  const closureReason =
    value.closure_reason === null
      ? null
      : isJobClosureReason(value.closure_reason)
        ? value.closure_reason
        : undefined;
  if (
    !isUuid(id) ||
    !isSupportedJobListingNumber(listingNumber) ||
    !isJobPostStatus(status) ||
    closesAt === undefined ||
    closureReason === undefined
  ) {
    return null;
  }

  const availability =
    closureReason === "expired" ||
    (status === "published" &&
      closesAt !== null &&
      Date.parse(closesAt) <= Date.now())
      ? "expired"
      : closureReason === "cancelled"
        ? "cancelled"
        : status === "published" && closesAt !== null
          ? "active"
          : "unavailable";

  return {
    id,
    listingNumber,
    title: cleanText(value.title),
    position: cleanText(value.position),
    startDate: optionalDate(value.start_date),
    status,
    availability,
  };
}

export function applicationResponse(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Authorization",
    },
  });
}

export function logJobApplicationError(
  event: string,
  error?: unknown,
  context: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error("[job-applications]", {
    event,
    ...context,
    error: safeError(error),
  });
}

function databaseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
}

function optionalDatabaseTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const parsed = databaseTimestamp(value);
  return parsed || undefined;
}

function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function candidateAvailabilityDate(value: unknown) {
  const date = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : "";
}

function safeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message.slice(0, 240) };
  }
  if (isRecord(error)) {
    return {
      code: cleanText(error.code).slice(0, 40),
      message: cleanText(error.message).slice(0, 240),
    };
  }
  return { message: String(error).slice(0, 240) };
}
