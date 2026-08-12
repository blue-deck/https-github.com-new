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
  calculateCrewProfileCompletion,
  crewExperienceYears,
  isPremiumCrewProfile,
  type CompletionExperience,
} from "./crewProfileCompletion";
import {
  maskedPersonName,
  personInitials,
  publicCandidateLanguageEntries,
  redactCandidateProfileText,
  safeCandidateCount,
  safeCandidateMeasurement,
} from "./crewCandidateDataServer";
import {
  isJobApplicationStatus,
  type EmployerJobApplication,
  type EmployerJobApplicationDetails,
  type JobApplicationJobSummary,
  type OwnJobApplication,
} from "./jobApplications";
import {
  buildEmployerApplicationMediaUrl,
  employerApplicationMediaRevision,
  selectEmployerApplicationGallerySources,
} from "./jobApplicationMediaServer";
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
  normalizePublicCrewId,
  publicCrewMediaUrl,
  publicStructuredProfileField,
  publicStructuredStringArray,
  safeOwnedPublicMediaUrl,
  selectOwnedPublicCrewGallerySources,
} from "./publicCrewSafety";
import { readLimitedJsonObjectDetailed } from "./requestBodyServer";

export const maximumApplicationRequestBytes = 8_192;
export const maximumCoverNoteLength = 2_000;
export const ownJobApplicationSelect =
  "id,job_post_id,status,cover_note,submitted_at,status_changed_at,withdrawn_at,updated_at,version";

export type ApplicationCandidatePreview = EmployerJobApplication["candidate"];

type CandidatePreviewResult =
  | { ok: true; previews: Map<string, ApplicationCandidatePreview> }
  | { ok: false; error: string };

type CandidateDetailsResult =
  | { ok: true; details: EmployerJobApplicationDetails }
  | { ok: false; error: string };

type PublicCrewMediaOverlay = {
  crewId: string;
  userId: string;
  profilePhotoUrl: string;
  galleryPhotos: string[];
};

type PublicCrewMediaOverlayResult =
  | { ok: true; overlays: Map<string, PublicCrewMediaOverlay> }
  | { ok: false; error?: unknown };

export function authenticatedApplicationClients(request: NextRequest) {
  return authenticatedEmployerClients(request);
}

export async function readApplicationBody(
  request: NextRequest,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const result = await readLimitedJsonObjectDetailed(
    request,
    maximumApplicationRequestBytes,
  );
  if (!result.ok && result.error === "content-type") {
    return { ok: false, error: "The request must use JSON.", status: 415 };
  }
  if (!result.ok && result.error === "too-large") {
    return { ok: false, error: "The request is too large.", status: 413 };
  }
  if (!result.ok) {
    return { ok: false, error: "The request contains invalid JSON.", status: 400 };
  }
  return { ok: true, value: result.value };
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
  const targets: Array<{
    applicationId: string;
    jobPostId: string;
    applicantUserId: string;
    crewProfileId: string;
  }> = [];

  for (const value of rows) {
    if (!isRecord(value)) {
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }
    const applicationId = cleanText(value.id);
    const jobPostId = cleanText(value.job_post_id);
    const applicantUserId = cleanText(value.applicant_user_id);
    const crewProfileId = cleanText(value.crew_profile_id);
    if (
      !isUuid(applicationId) ||
      !isUuid(jobPostId) ||
      !isUuid(applicantUserId)
    ) {
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }
    targets.push({ applicationId, jobPostId, applicantUserId, crewProfileId });
  }

  const previews = new Map<string, ApplicationCandidatePreview>();
  const [snapshots, publicMedia] = await Promise.all([
    loadAvailableApplicationSnapshots(
      serviceClient,
      targets.map((target) => target.applicationId),
    ),
    loadPublicCrewMediaOverlays(
      serviceClient,
      targets.map((target) => target.crewProfileId),
      false,
    ),
  ]);
  if (!snapshots.ok) {
    return { ok: false, error: "Candidate profiles could not be loaded." };
  }
  if (!publicMedia.ok) {
    logJobApplicationError("public_candidate_media_overlay_load_failed", publicMedia.error, {
      applicationCount: targets.length,
    });
  }

  for (const target of targets) {
    const snapshot = snapshots.rows.get(target.applicationId);
    if (!snapshot || !isUuid(target.crewProfileId)) continue;

    const candidate = recordValue(snapshot.candidate_snapshot);
    const media = recordValue(snapshot.media_snapshot);
    const profile = recordValue(candidate.profile);
    const experiences = recordArray(candidate.experiences) as CompletionExperience[];
    const discoveryNotes = cleanText(profile.notes);
    const discovery = parseCrewDiscoverySettings(discoveryNotes);
    const completionPercent = calculateCrewProfileCompletion({
      profile,
      experiences,
    });
    const avatarSource = safeOwnedPublicMediaUrl(media.avatar_source, [
      target.crewProfileId,
      target.applicantUserId,
    ]);
    const capturedAt = databaseTimestamp(snapshot.captured_at);
    const avatarRevision = employerApplicationMediaRevision(
      capturedAt,
      avatarSource,
    );
    const overlayCandidate = publicMedia.ok
      ? publicMedia.overlays.get(target.crewProfileId)
      : undefined;
    const publicOverlay =
      overlayCandidate?.userId === target.applicantUserId
        ? overlayCandidate
        : undefined;

    previews.set(target.applicationId, {
      displayName: "",
      initials: "",
      profilePhotoUrl: publicOverlay
        ? publicOverlay.profilePhotoUrl
        : avatarSource && avatarRevision
          ? buildEmployerApplicationMediaUrl({
              jobPostId: target.jobPostId,
              applicationId: target.applicationId,
              kind: "avatar",
              revision: avatarRevision,
            })
          : "",
      currentPosition:
        publicStructuredStringArray(profile.current_positions, 1, 120)[0] ||
        publicStructuredProfileField(profile.current_position, 120),
      nationality: publicStructuredProfileField(profile.nationality, 80),
      availabilityStatus: discoveryNotes.startsWith(crewDiscoveryNotesPrefix)
        ? discovery.availabilityStatus
        : "",
      experienceYears: crewExperienceYears(experiences),
      cvCompletionPercent: completionPercent,
      premiumProfile: isPremiumCrewProfile(completionPercent),
    });
  }

  return { ok: true, previews };
}

export function applicationApplicantUserId(value: unknown) {
  if (!isRecord(value)) return "";
  const applicantUserId = cleanText(value.applicant_user_id);
  return isUuid(applicantUserId) ? applicantUserId : "";
}

export function applicationCandidatePreviewKey(value: unknown) {
  if (!isRecord(value)) return "";
  const applicationId = cleanText(value.id);
  return isUuid(applicationId) ? applicationId : "";
}

export async function loadApplicationCandidateDetails(
  serviceClient: SupabaseClient,
  applicationRow: unknown,
): Promise<CandidateDetailsResult> {
  if (!isRecord(applicationRow)) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }

  const applicationId = cleanText(applicationRow.id);
  const jobPostId = cleanText(applicationRow.job_post_id);
  const applicantUserId = applicationApplicantUserId(applicationRow);
  const crewProfileId = cleanText(applicationRow.crew_profile_id);
  const snapshotName =
    publicStructuredProfileField(applicationRow.applicant_name_snapshot, 120) ||
    "BlueDeck candidate";
  const snapshotPosition = publicStructuredProfileField(
    applicationRow.applicant_position_snapshot,
    120,
  );

  if (!isUuid(applicationId) || !isUuid(jobPostId) || !applicantUserId) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }

  if (!isUuid(crewProfileId)) {
    return {
      ok: true,
      details: emptyCandidateDetails(
        applicationId,
        snapshotName,
        snapshotPosition,
      ),
    };
  }

  const [snapshots, publicMedia] = await Promise.all([
    loadAvailableApplicationSnapshots(serviceClient, [applicationId]),
    loadPublicCrewMediaOverlays(serviceClient, [crewProfileId], true),
  ]);
  if (!snapshots.ok) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }
  if (!publicMedia.ok) {
    logJobApplicationError("public_candidate_media_overlay_load_failed", publicMedia.error, {
      applicationId,
    });
  }

  const snapshot = snapshots.rows.get(applicationId);
  if (!snapshot) {
    return {
      ok: true,
      details: emptyCandidateDetails(
        applicationId,
        snapshotName,
        snapshotPosition,
      ),
    };
  }

  const candidate = recordValue(snapshot.candidate_snapshot);
  const media = recordValue(snapshot.media_snapshot);
  const profile = recordValue(candidate.profile);
  const experiences = recordArray(candidate.experiences) as CompletionExperience[];
  const discovery = parseCrewDiscoverySettings(cleanText(profile.notes));
  const completionPercent = calculateCrewProfileCompletion({
    profile,
    experiences,
  });
  const currentPosition =
    publicStructuredStringArray(profile.current_positions, 1, 120)[0] ||
    publicStructuredProfileField(profile.current_position, 120) ||
    snapshotPosition;
  const capturedAt = databaseTimestamp(snapshot.captured_at);
  const avatarSource = safeOwnedPublicMediaUrl(media.avatar_source, [
    crewProfileId,
    applicantUserId,
  ]);
  const avatarRevision = employerApplicationMediaRevision(
    capturedAt,
    avatarSource,
  );
  const gallerySources = selectEmployerApplicationGallerySources(
    recordArray(media.gallery),
    applicationId,
    [crewProfileId, applicantUserId],
  );
  const overlayCandidate = publicMedia.ok
    ? publicMedia.overlays.get(crewProfileId)
    : undefined;
  const publicOverlay =
    overlayCandidate?.userId === applicantUserId
      ? overlayCandidate
      : undefined;

  return {
    ok: true,
    details: {
      applicationId,
      candidate: {
        displayName: maskedPersonName(snapshotName),
        initials: personInitials(snapshotName),
        profilePhotoUrl: publicOverlay
          ? publicOverlay.profilePhotoUrl
          : avatarSource && avatarRevision
            ? buildEmployerApplicationMediaUrl({
                jobPostId,
                applicationId,
                kind: "avatar",
                revision: avatarRevision,
              })
            : "",
        currentPosition,
        nationality: publicStructuredProfileField(profile.nationality, 80),
        location: publicStructuredProfileField(profile.location, 120),
        gender: publicStructuredProfileField(profile.gender, 60),
        heightCm: safeCandidateMeasurement(profile.height_cm, 80, 260),
        weightKg: safeCandidateMeasurement(profile.weight_kg, 20, 400),
        smoker: publicStructuredProfileField(profile.smoker, 60),
        visibleTattoos: publicStructuredProfileField(
          profile.visible_tattoos,
          120,
        ),
        professionalSummary: redactCandidateProfileText(
          profile.bio,
          snapshotName,
          2_000,
        ),
        skills: publicStructuredStringArray(profile.personal_skills, 30, 120),
        characteristics: publicStructuredStringArray(
          profile.personal_characteristics,
          30,
          120,
        ),
        workPreferences: publicStructuredStringArray(
          profile.work_preferences,
          30,
          120,
        ),
        seekingPositions: publicStructuredStringArray(
          profile.seeking_positions,
          30,
          120,
        ),
        employmentTypes: discovery.employmentTypes
          .map((item) => publicStructuredProfileField(item, 120))
          .filter(Boolean),
        preferredLocations: discovery.preferredLocations
          .map((item) => publicStructuredProfileField(item, 120))
          .filter(Boolean),
        languages: publicCandidateLanguageEntries(profile.languages),
        galleryPhotos: publicOverlay
          ? publicOverlay.galleryPhotos
          : gallerySources
              .map((source, slot) => {
                const revision = employerApplicationMediaRevision(
                  capturedAt,
                  source,
                );
                return revision
                  ? buildEmployerApplicationMediaUrl({
                      jobPostId,
                      applicationId,
                      kind: "gallery",
                      slot,
                      revision,
                    })
                  : "";
              })
              .filter(Boolean),
        referenceCount: safeCandidateCount(
          typeof candidate.reference_count === "number"
            ? candidate.reference_count
            : null,
        ),
        documentCount: safeCandidateCount(
          typeof candidate.document_count === "number"
            ? candidate.document_count
            : null,
        ),
        experienceYears: safeCandidateCount(
          typeof candidate.experience_years === "number"
            ? candidate.experience_years
            : null,
        ),
        publicCrewId: publicOverlay?.crewId || "",
        portalAvailable: Boolean(publicOverlay?.crewId),
        cvCompletionPercent: completionPercent,
        premiumProfile: isPremiumCrewProfile(completionPercent),
      },
    },
  };
}

async function loadPublicCrewMediaOverlays(
  serviceClient: SupabaseClient,
  profileIds: string[],
  includeGallery: boolean,
): Promise<PublicCrewMediaOverlayResult> {
  const ids = Array.from(new Set(profileIds.filter(isUuid)));
  if (ids.length === 0) return { ok: true, overlays: new Map() };
  if (ids.length > 50) return { ok: false, error: "profile_limit_exceeded" };

  const { data, error } = await serviceClient.rpc(
    "bluedeck_public_crew_media_manifest",
    {
      p_profile_ids: ids,
      p_include_gallery: includeGallery,
    },
  );
  if (error || !Array.isArray(data)) {
    return { ok: false, error: error || "invalid_manifest_response" };
  }

  const overlays = new Map<string, PublicCrewMediaOverlay>();
  const requestedIds = new Set(ids);
  for (const value of data) {
    if (!isRecord(value)) return { ok: false, error: "invalid_manifest_row" };

    const profileId = cleanText(value.profile_id).toLowerCase();
    const userId = cleanText(value.user_id).toLowerCase();
    const crewId = normalizePublicCrewId(cleanText(value.public_crew_id));
    if (
      !isUuid(profileId) ||
      !isUuid(userId) ||
      !requestedIds.has(profileId) ||
      !crewId ||
      overlays.has(profileId)
    ) {
      return { ok: false, error: "invalid_manifest_row" };
    }

    const avatarSource = safeOwnedPublicMediaUrl(value.avatar_source, [
      profileId,
      userId,
    ]);
    const gallerySources = includeGallery
      ? selectOwnedPublicCrewGallerySources(
          recordArray(value.gallery),
          profileId,
          [profileId, userId],
        )
      : [];

    overlays.set(profileId, {
      crewId,
      userId,
      profilePhotoUrl: avatarSource
        ? publicCrewMediaUrl(crewId, "avatar")
        : "",
      galleryPhotos: gallerySources
        .map((_source, slot) => publicCrewMediaUrl(crewId, "gallery", slot))
        .filter(Boolean),
    });
  }

  return { ok: true, overlays };
}

type ApplicationSnapshotRow = {
  application_id: string;
  candidate_snapshot: unknown;
  media_snapshot: unknown;
  captured_at: string;
  expires_at: string;
  purged_at: null;
};

async function loadAvailableApplicationSnapshots(
  serviceClient: SupabaseClient,
  applicationIds: string[],
): Promise<
  | { ok: true; rows: Map<string, ApplicationSnapshotRow> }
  | { ok: false }
> {
  const ids = Array.from(new Set(applicationIds.filter(isUuid)));
  const rows = new Map<string, ApplicationSnapshotRow>();
  const now = new Date().toISOString();

  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100);
    const { data, error } = await serviceClient
      .from("job_application_snapshots")
      .select(
        "application_id,candidate_snapshot,media_snapshot,captured_at,expires_at,purged_at",
      )
      .in("application_id", batch)
      .is("purged_at", null)
      .gt("expires_at", now);

    if (error) {
      logJobApplicationError("application_snapshot_load_failed", error, {
        applicationCount: batch.length,
      });
      return { ok: false };
    }

    for (const value of data || []) {
      const applicationId = cleanText(value.application_id);
      const capturedAt = databaseTimestamp(value.captured_at);
      const expiresAt = databaseTimestamp(value.expires_at);
      if (
        !isUuid(applicationId) ||
        !capturedAt ||
        !expiresAt ||
        value.purged_at !== null ||
        !isRecord(value.candidate_snapshot) ||
        !isRecord(value.media_snapshot)
      ) {
        logJobApplicationError("invalid_application_snapshot_record", undefined, {
          applicationId: applicationId || "unknown",
        });
        return { ok: false };
      }

      rows.set(applicationId, {
        application_id: applicationId,
        candidate_snapshot: value.candidate_snapshot,
        media_snapshot: value.media_snapshot,
        captured_at: capturedAt,
        expires_at: expiresAt,
        purged_at: null,
      });
    }
  }

  return { ok: true, rows };
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
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
      displayName: maskedPersonName(fullName),
      initials: personInitials(fullName),
      profilePhotoUrl: preview?.profilePhotoUrl || "",
      currentPosition: preview?.currentPosition || currentPosition,
      nationality: preview?.nationality || "",
      availabilityStatus: preview?.availabilityStatus || "",
      experienceYears: preview?.experienceYears || 0,
      cvCompletionPercent: preview?.cvCompletionPercent || 0,
      premiumProfile: preview?.premiumProfile || false,
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

export function applicationResponse(
  body: object,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Authorization");
  return Response.json(body, {
    status,
    headers,
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

function emptyCandidateDetails(
  applicationId: string,
  fullName: string,
  currentPosition: string,
): EmployerJobApplicationDetails {
  return {
    applicationId,
    candidate: {
      displayName: maskedPersonName(fullName),
      initials: personInitials(fullName),
      profilePhotoUrl: "",
      currentPosition,
      nationality: "",
      location: "",
      gender: "",
      heightCm: null,
      weightKg: null,
      smoker: "",
      visibleTattoos: "",
      professionalSummary: "",
      skills: [],
      characteristics: [],
      workPreferences: [],
      seekingPositions: [],
      employmentTypes: [],
      preferredLocations: [],
      languages: [],
      galleryPhotos: [],
      referenceCount: 0,
      documentCount: 0,
      experienceYears: 0,
      publicCrewId: "",
      portalAvailable: false,
      cvCompletionPercent: 0,
      premiumProfile: false,
    },
  };
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
