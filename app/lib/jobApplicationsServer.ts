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
  countExperienceReferences,
  crewExperienceYears,
  isPremiumCrewProfile,
  type CompletionExperience,
} from "./crewProfileCompletion";
import {
  loadCandidateExperienceRows,
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
  getPublicCrewDiscoverySettings,
  normalizePublicCrewId,
  publicStructuredProfileField,
  publicStructuredStringArray,
  safeOwnedPublicMediaUrl,
} from "./publicCrewSafety";

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
  const profileIds = Array.from(
    new Set(targets.map((target) => target.crewProfileId).filter(isUuid)),
  );

  for (let index = 0; index < profileIds.length; index += 100) {
    const batch = profileIds.slice(index, index + 100);
    const { data: profiles, error } = await serviceClient
      .from("crew_profiles")
      .select(
        "id,user_id,full_name,email,phone,profile_photo_url,current_position,current_positions,location,nationality,gender,date_of_birth,height_cm,weight_kg,smoker,visible_tattoos,bio,languages,personal_skills,personal_characteristics,work_preferences,notes,created_at",
      )
      .in("id", batch);

    if (error) {
      logJobApplicationError("candidate_preview_load_failed", error, {
        candidateCount: batch.length,
      });
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }

    const experiencesByProfile = new Map<string, CompletionExperience[]>();

    if (batch.length > 0) {
      const experienceResult = await loadCandidateExperienceRows(
        serviceClient,
        batch,
      );

      if (experienceResult.error) {
        logJobApplicationError(
          "candidate_preview_experience_load_failed",
          experienceResult.error,
          { candidateCount: batch.length },
        );
        return { ok: false, error: "Candidate profiles could not be loaded." };
      }

      for (const experience of experienceResult.rows) {
        const profileId = cleanText(experience.crew_profile_id);
        if (!isUuid(profileId)) continue;
        const current = experiencesByProfile.get(profileId) || [];
        current.push(experience as CompletionExperience);
        experiencesByProfile.set(profileId, current);
      }
    }

    const profilesById = new Map(
      (profiles || [])
        .map((profile) => [cleanText(profile.id), profile] as const)
        .filter(([profileId]) => isUuid(profileId)),
    );

    for (const target of targets) {
      if (!batch.includes(target.crewProfileId)) continue;
      const row = profilesById.get(target.crewProfileId);
      if (!row || cleanText(row.user_id) !== target.applicantUserId) continue;
      const profileId = cleanText(row.id);
      const experiences = experiencesByProfile.get(profileId) || [];
      const discoveryNotes =
        typeof row.notes === "string" ? row.notes.trim() : "";
      const hasSavedDiscoverySettings = discoveryNotes.startsWith(
        crewDiscoveryNotesPrefix,
      );
      const discovery = parseCrewDiscoverySettings(discoveryNotes);
      const completionPercent = calculateCrewProfileCompletion({
        profile: row,
        experiences,
      });
      const hasAvatar = Boolean(
        safeOwnedPublicMediaUrl(row.profile_photo_url, [
          profileId,
          target.applicantUserId,
        ]),
      );

      previews.set(target.applicationId, {
        displayName: "",
        initials: "",
        profilePhotoUrl: hasAvatar
          ? buildEmployerApplicationMediaUrl({
              jobPostId: target.jobPostId,
              applicationId: target.applicationId,
              kind: "avatar",
            })
          : "",
        currentPosition:
          publicStructuredStringArray(row.current_positions, 1, 120)[0] ||
          publicStructuredProfileField(row.current_position, 120),
        nationality: publicStructuredProfileField(row.nationality, 80),
        availabilityStatus: hasSavedDiscoverySettings
          ? discovery.availabilityStatus
          : "",
        experienceYears: crewExperienceYears(experiences),
        cvCompletionPercent: completionPercent,
        premiumProfile: isPremiumCrewProfile(completionPercent),
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

  const { data: profile, error: profileError } = await serviceClient
    .from("crew_profiles")
    .select(
      "id,user_id,public_crew_id,full_name,email,phone,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,gender,date_of_birth,height_cm,weight_kg,smoker,visible_tattoos,bio,languages,personal_skills,personal_characteristics,work_preferences,notes",
    )
    .eq("id", crewProfileId)
    .eq("user_id", applicantUserId)
    .maybeSingle();

  if (profileError) {
    logJobApplicationError("candidate_detail_profile_load_failed", profileError, {
      applicationId,
      crewProfileId,
    });
    return { ok: false, error: "Candidate profile could not be loaded." };
  }

  if (!profile) {
    return {
      ok: true,
      details: emptyCandidateDetails(
        applicationId,
        snapshotName,
        snapshotPosition,
      ),
    };
  }

  const [photoResult, documentResult, referenceResult, experienceResult] =
    await Promise.all([
      serviceClient
        .from("crew_portfolio_photos")
        .select("id,image_url,created_at")
        .eq("crew_profile_id", crewProfileId)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
      serviceClient
        .from("crew_documents")
        .select("id", { count: "exact", head: true })
        .eq("crew_profile_id", crewProfileId),
      serviceClient
        .from("crew_references")
        .select("id,vessel")
        .eq("crew_profile_id", crewProfileId),
      loadCandidateExperienceRows(serviceClient, [crewProfileId]),
    ]);

  const relatedError =
    photoResult.error ||
    documentResult.error ||
    referenceResult.error ||
    experienceResult.error;
  if (relatedError) {
    logJobApplicationError("candidate_detail_related_load_failed", relatedError, {
      applicationId,
      crewProfileId,
    });
    return { ok: false, error: "Candidate profile could not be loaded." };
  }

  const experiences = experienceResult.rows;
  let gender = publicStructuredProfileField(profile.gender, 60);
  if (!gender) {
    const { data: accountData, error: accountError } =
      await serviceClient.auth.admin.getUserById(applicantUserId);
    if (accountError) {
      logJobApplicationError("candidate_detail_gender_fallback_failed", accountError, {
        applicationId,
        crewProfileId,
      });
    } else {
      gender = publicStructuredProfileField(
        accountData.user?.user_metadata?.gender,
        60,
      );
    }
  }
  const discovery = parseCrewDiscoverySettings(cleanText(profile.notes));
  const completionPercent = calculateCrewProfileCompletion({
    profile,
    experiences,
  });
  const publicCrewId = normalizePublicCrewId(cleanText(profile.public_crew_id));
  const portalAvailable = Boolean(
    publicCrewId && getPublicCrewDiscoverySettings(profile.notes),
  );
  const currentPosition =
    publicStructuredStringArray(profile.current_positions, 1, 120)[0] ||
    publicStructuredProfileField(profile.current_position, 120) ||
    snapshotPosition;
  const avatarSource = safeOwnedPublicMediaUrl(profile.profile_photo_url, [
    crewProfileId,
    applicantUserId,
  ]);
  const gallerySources = selectEmployerApplicationGallerySources(
    photoResult.data || [],
    applicationId,
    [crewProfileId, applicantUserId],
  );

  return {
    ok: true,
    details: {
      applicationId,
      candidate: {
        displayName: maskedPersonName(snapshotName),
        initials: personInitials(snapshotName),
        profilePhotoUrl: avatarSource
          ? buildEmployerApplicationMediaUrl({
              jobPostId,
              applicationId,
              kind: "avatar",
            })
          : "",
        currentPosition,
        nationality: publicStructuredProfileField(profile.nationality, 80),
        location: publicStructuredProfileField(profile.location, 120),
        gender,
        heightCm: safeCandidateMeasurement(profile.height_cm, 80, 260),
        weightKg: safeCandidateMeasurement(profile.weight_kg, 20, 400),
        smoker: publicStructuredProfileField(profile.smoker, 60),
        visibleTattoos: publicStructuredProfileField(
          profile.visible_tattoos,
          120,
        ),
        professionalSummary: redactCandidateProfileText(
          profile.bio,
          publicStructuredProfileField(profile.full_name, 120) || snapshotName,
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
        galleryPhotos: gallerySources.map((_source, slot) =>
          buildEmployerApplicationMediaUrl({
            jobPostId,
            applicationId,
            kind: "gallery",
            slot,
          }),
        ).filter(Boolean),
        referenceCount: countExperienceReferences(
          experiences,
          referenceResult.data || [],
        ),
        documentCount: safeCandidateCount(documentResult.count),
        experienceYears: crewExperienceYears(experiences),
        publicCrewId: portalAvailable ? publicCrewId : "",
        portalAvailable,
        cvCompletionPercent: completionPercent,
        premiumProfile: isPremiumCrewProfile(completionPercent),
      },
    },
  };
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
