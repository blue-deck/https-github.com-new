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
  isJobApplicationMode,
  isJobApplicationStatus,
  type EmployerJobApplication,
  type EmployerJobApplicationDetails,
  type EmployerJobApplicationMember,
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
  publicStructuredProfileField,
  publicStructuredStringArray,
  safeOwnedPublicMediaUrl,
} from "./publicCrewSafety";
import { readLimitedJsonObjectDetailed } from "./requestBodyServer";

export const maximumApplicationRequestBytes = 8_192;
export const maximumCoverNoteLength = 2_000;
export const ownJobApplicationSelect =
  "id,job_post_id,application_mode,status,cover_note,submitted_at,status_changed_at,withdrawn_at,updated_at,version";
export const jobApplicationTeamMemberSelect =
  "id,application_id,job_post_id,member_user_id,crew_profile_id,member_role,member_name_snapshot,member_position_snapshot,member_public_crew_id_snapshot,is_primary,created_at";
const jobApplicationTeamMemberSnapshotSelect =
  "id,application_id,job_post_id,candidate_snapshot,media_snapshot,captured_at,expires_at,purged_at";

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
  if (
    Object.keys(value).some(
      (key) => key !== "coverNote" && key !== "applyAsTeam",
    )
  ) {
    return { ok: false as const, error: "The request contains unsupported fields." };
  }
  if (value.coverNote !== undefined && typeof value.coverNote !== "string") {
    return { ok: false as const, error: "The application note is invalid." };
  }

  const coverNote = cleanText(value.coverNote);
  if (coverNote.length > maximumCoverNoteLength) {
    return { ok: false as const, error: "The application note is too long." };
  }
  if (
    value.applyAsTeam !== undefined &&
    typeof value.applyAsTeam !== "boolean"
  ) {
    return { ok: false as const, error: "The application type is invalid." };
  }
  return {
    ok: true as const,
    coverNote,
    applyAsTeam: value.applyAsTeam === true,
  };
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

type ApplicationTeamMemberRow = {
  id: string;
  applicationId: string;
  jobPostId: string;
  memberUserId: string;
  crewProfileId: string;
  memberRole: "crew" | "captain";
  memberName: string;
  memberPosition: string;
  publicCrewId: string;
  isPrimary: boolean;
};

type ApplicationTeamMemberSnapshot = {
  memberId: string;
  applicationId: string;
  jobPostId: string;
  snapshot?: ApplicationSnapshotRow;
};

type CandidateMembersResult =
  | { ok: true; members: Map<string, EmployerJobApplicationMember[]> }
  | { ok: false; error: string };

export async function loadApplicationTeamMembers(
  serviceClient: SupabaseClient,
  rows: unknown[],
): Promise<CandidateMembersResult> {
  const targets = applicationTargets(rows);
  if (!targets) {
    return { ok: false, error: "Candidate profiles could not be loaded." };
  }

  const [memberRows, primarySnapshots] = await Promise.all([
    loadApplicationTeamMemberRows(serviceClient, targets),
    loadAvailableApplicationSnapshots(serviceClient, Array.from(targets.keys())),
  ]);
  if (!memberRows.ok || !primarySnapshots.ok) {
    return { ok: false, error: "Candidate profiles could not be loaded." };
  }

  const primaryMembers = new Map<string, ApplicationTeamMemberRow>();
  const missingPrimarySnapshots: ApplicationTeamMemberRow[] = [];
  for (const [applicationId, target] of targets) {
    const applicationMembers = memberRows.rows.get(applicationId) || [];
    if (!validApplicationMemberSet(target, applicationMembers)) {
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }

    const primary = applicationMembers.find((member) => member.isPrimary);
    if (!primary) {
      return { ok: false, error: "Candidate profiles could not be loaded." };
    }
    primaryMembers.set(applicationId, primary);
    if (!primarySnapshots.rows.has(applicationId)) {
      missingPrimarySnapshots.push(primary);
    }
  }

  const childPrimarySnapshots = await loadApplicationTeamMemberSnapshots(
    serviceClient,
    missingPrimarySnapshots,
  );
  if (!childPrimarySnapshots.ok) {
    return { ok: false, error: "Candidate profiles could not be loaded." };
  }

  const members = new Map<string, EmployerJobApplicationMember[]>();
  for (const [applicationId] of targets) {
    const applicationMembers = memberRows.rows.get(applicationId) || [];
    const primary = primaryMembers.get(applicationId);

    members.set(
      applicationId,
      applicationMembers.map((member) =>
        employerMemberFromSnapshot(
          member,
          member.id === primary?.id
            ? primarySnapshots.rows.get(applicationId) ||
                childPrimarySnapshots.rows.get(member.id)
            : undefined,
        ),
      ),
    );
  }

  return { ok: true, members };
}

export function applicationApplicantUserId(value: unknown) {
  if (!isRecord(value)) return "";
  const applicantUserId = cleanText(value.applicant_user_id);
  return isUuid(applicantUserId) ? applicantUserId : "";
}

export async function loadApplicationCandidateDetails(
  serviceClient: SupabaseClient,
  applicationRow: unknown,
  requestedMemberId = "",
): Promise<CandidateDetailsResult> {
  const targets = applicationTargets([applicationRow]);
  if (!targets || targets.size !== 1) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }
  const [applicationId, target] = Array.from(targets.entries())[0];
  const memberRows = await loadApplicationTeamMemberRows(serviceClient, targets);
  if (!memberRows.ok) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }

  const applicationMembers = memberRows.rows.get(applicationId) || [];
  if (!validApplicationMemberSet(target, applicationMembers)) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }
  const member = requestedMemberId
    ? applicationMembers.find((candidate) => candidate.id === requestedMemberId)
    : applicationMembers.find((candidate) => candidate.isPrimary);
  if (!member || member.jobPostId !== target.jobPostId) {
    return { ok: false, error: "Candidate profile could not be loaded." };
  }

  let snapshot: ApplicationSnapshotRow | undefined;
  if (member.isPrimary) {
    const primarySnapshots = await loadAvailableApplicationSnapshots(
      serviceClient,
      [applicationId],
    );
    if (!primarySnapshots.ok) {
      return { ok: false, error: "Candidate profile could not be loaded." };
    }
    snapshot = primarySnapshots.rows.get(applicationId);
  }

  if (!snapshot) {
    const memberSnapshots = await loadApplicationTeamMemberSnapshots(
      serviceClient,
      [member],
    );
    if (!memberSnapshots.ok) {
      return { ok: false, error: "Candidate profile could not be loaded." };
    }
    snapshot = memberSnapshots.rows.get(member.id);
  }

  if (!snapshot) {
    return {
      ok: true,
      details: emptyCandidateDetails(
        applicationId,
        member.id,
        member.isPrimary,
        member.memberName,
        member.memberPosition,
      ),
    };
  }

  const candidate = recordValue(snapshot.candidate_snapshot);
  const media = recordValue(snapshot.media_snapshot);
  const profile = recordValue(candidate.profile);
  const experiences = recordArray(candidate.experiences) as CompletionExperience[];
  const discovery = parseCrewDiscoverySettings(cleanText(profile.notes));
  const completionPercent = calculateCrewProfileCompletion({ profile, experiences });
  const currentPosition =
    publicStructuredStringArray(profile.current_positions, 1, 120)[0] ||
    publicStructuredProfileField(profile.current_position, 120) ||
    member.memberPosition;
  const capturedAt = databaseTimestamp(snapshot.captured_at);
  const mediaOwnerIds = applicationMemberMediaOwnerIds(member);
  const avatarSource = mediaOwnerIds.length
    ? safeOwnedPublicMediaUrl(media.avatar_source, mediaOwnerIds)
    : "";
  const avatarRevision = employerApplicationMediaRevision(capturedAt, avatarSource);
  const gallerySources = mediaOwnerIds.length
    ? selectEmployerApplicationGallerySources(
        recordArray(media.gallery),
        member.id,
        mediaOwnerIds,
      )
    : [];

  return {
    ok: true,
    details: {
      applicationId,
      memberId: member.id,
      isPrimaryMember: member.isPrimary,
      candidate: {
        displayName: maskedPersonName(member.memberName),
        initials: personInitials(member.memberName),
        profilePhotoUrl:
          avatarSource && avatarRevision
            ? buildEmployerApplicationMediaUrl({
                jobPostId: member.jobPostId,
                applicationId,
                memberId: member.id,
                kind: "avatar",
                revision: avatarRevision,
              })
            : "",
        currentPosition,
        nationality: publicStructuredProfileField(profile.nationality, 80),
        location: publicStructuredProfileField(profile.location, 120),
        gender: publicStructuredProfileField(profile.gender, 60),
        maritalStatus: publicStructuredProfileField(profile.marital_status, 16),
        heightCm: safeCandidateMeasurement(profile.height_cm, 80, 260),
        weightKg: safeCandidateMeasurement(profile.weight_kg, 20, 400),
        smoker: publicStructuredProfileField(profile.smoker, 60),
        visibleTattoos: publicStructuredProfileField(profile.visible_tattoos, 120),
        professionalSummary: redactCandidateProfileText(
          profile.bio,
          member.memberName,
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
        galleryPhotos: gallerySources
          .map((source, slot) => {
            const revision = employerApplicationMediaRevision(capturedAt, source);
            return revision
              ? buildEmployerApplicationMediaUrl({
                  jobPostId: member.jobPostId,
                  applicationId,
                  memberId: member.id,
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
        publicCrewId: "",
        portalAvailable: false,
        cvCompletionPercent: completionPercent,
        premiumProfile: isPremiumCrewProfile(completionPercent),
      },
    },
  };
}

function applicationTargets(rows: unknown[]) {
  const targets = new Map<
    string,
    {
      jobPostId: string;
      applicantUserId: string;
      applicationMode: "individual" | "team_couple";
    }
  >();

  for (const value of rows) {
    if (!isRecord(value)) return null;
    const applicationId = cleanText(value.id).toLowerCase();
    const jobPostId = cleanText(value.job_post_id).toLowerCase();
    const applicantUserId = cleanText(value.applicant_user_id).toLowerCase();
    if (
      !isUuid(applicationId) ||
      !isUuid(jobPostId) ||
      !isUuid(applicantUserId) ||
      !isJobApplicationMode(value.application_mode) ||
      targets.has(applicationId)
    ) {
      return null;
    }
    targets.set(applicationId, {
      jobPostId,
      applicantUserId,
      applicationMode: value.application_mode,
    });
  }

  return targets;
}

function validApplicationMemberSet(
  target: {
    applicantUserId: string;
    applicationMode: "individual" | "team_couple";
  },
  members: ApplicationTeamMemberRow[],
) {
  const primaryMembers = members.filter((member) => member.isPrimary);
  const validModeCount =
    target.applicationMode === "individual"
      ? members.length === 1
      : members.length >= 2 && members.length <= 8;
  return (
    primaryMembers.length === 1 &&
    primaryMembers[0].memberUserId === target.applicantUserId &&
    validModeCount
  );
}

async function loadApplicationTeamMemberRows(
  serviceClient: SupabaseClient,
  targets: Map<
    string,
    {
      jobPostId: string;
      applicantUserId: string;
      applicationMode: "individual" | "team_couple";
    }
  >,
): Promise<
  | { ok: true; rows: Map<string, ApplicationTeamMemberRow[]> }
  | { ok: false }
> {
  const applicationIds = Array.from(targets.keys());
  const rows = new Map<string, ApplicationTeamMemberRow[]>();
  const seenMemberIds = new Set<string>();
  for (const applicationId of applicationIds) rows.set(applicationId, []);

  for (let index = 0; index < applicationIds.length; index += 50) {
    const batch = applicationIds.slice(index, index + 50);
    const { data, error } = await serviceClient
      .from("job_application_team_members")
      .select(jobApplicationTeamMemberSelect)
      .in("application_id", batch)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      logJobApplicationError("application_team_members_load_failed", error, {
        applicationCount: batch.length,
      });
      return { ok: false };
    }

    for (const value of data || []) {
      const member = applicationTeamMemberFromRow(value);
      const target = member ? targets.get(member.applicationId) : undefined;
      if (
        !member ||
        !target ||
        member.jobPostId !== target.jobPostId ||
        seenMemberIds.has(member.id)
      ) {
        logJobApplicationError("invalid_application_team_member_record", undefined, {
          applicationId: member?.applicationId || "unknown",
        });
        return { ok: false };
      }
      seenMemberIds.add(member.id);
      rows.get(member.applicationId)?.push(member);
    }
  }

  return { ok: true, rows };
}

function applicationTeamMemberFromRow(
  value: unknown,
): ApplicationTeamMemberRow | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id).toLowerCase();
  const applicationId = cleanText(value.application_id).toLowerCase();
  const jobPostId = cleanText(value.job_post_id).toLowerCase();
  const memberUserId = cleanText(value.member_user_id).toLowerCase();
  const crewProfileId = cleanText(value.crew_profile_id).toLowerCase();
  const memberRole = cleanText(value.member_role).toLowerCase();
  const memberName =
    publicStructuredProfileField(value.member_name_snapshot, 120) ||
    "BlueDeck candidate";
  const memberPosition = publicStructuredProfileField(
    value.member_position_snapshot,
    120,
  );
  const publicCrewId = publicStructuredProfileField(
    value.member_public_crew_id_snapshot,
    64,
  );

  if (
    !isUuid(id) ||
    !isUuid(applicationId) ||
    !isUuid(jobPostId) ||
    !isUuid(memberUserId) ||
    (crewProfileId && !isUuid(crewProfileId)) ||
    (memberRole !== "crew" && memberRole !== "captain") ||
    typeof value.is_primary !== "boolean"
  ) {
    return null;
  }

  return {
    id,
    applicationId,
    jobPostId,
    memberUserId,
    crewProfileId,
    memberRole,
    memberName,
    memberPosition,
    publicCrewId,
    isPrimary: value.is_primary,
  };
}

function applicationMemberMediaOwnerIds(member: ApplicationTeamMemberRow) {
  return isUuid(member.memberUserId) && isUuid(member.crewProfileId)
    ? [member.crewProfileId, member.memberUserId]
    : [];
}

async function loadApplicationTeamMemberSnapshots(
  serviceClient: SupabaseClient,
  members: ApplicationTeamMemberRow[],
): Promise<
  | { ok: true; rows: Map<string, ApplicationSnapshotRow> }
  | { ok: false }
> {
  const expectedMembers = new Map(
    members.map((member) => [member.id, member] as const),
  );
  const memberIds = Array.from(expectedMembers.keys());
  const rows = new Map<string, ApplicationSnapshotRow>();

  for (let index = 0; index < memberIds.length; index += 50) {
    const batch = memberIds.slice(index, index + 50);
    const { data, error } = await serviceClient
      .from("job_application_team_members")
      .select(jobApplicationTeamMemberSnapshotSelect)
      .in("id", batch);

    if (error) {
      logJobApplicationError("application_team_member_snapshots_load_failed", error, {
        memberCount: batch.length,
      });
      return { ok: false };
    }

    const seen = new Set<string>();
    for (const value of data || []) {
      const parsed = applicationTeamMemberSnapshotFromRow(value);
      const expected = parsed ? expectedMembers.get(parsed.memberId) : undefined;
      if (
        !parsed ||
        !expected ||
        parsed.applicationId !== expected.applicationId ||
        parsed.jobPostId !== expected.jobPostId ||
        seen.has(parsed.memberId)
      ) {
        logJobApplicationError(
          "invalid_application_team_member_snapshot_record",
          undefined,
          { memberId: parsed?.memberId || "unknown" },
        );
        return { ok: false };
      }
      seen.add(parsed.memberId);
      if (parsed.snapshot) rows.set(parsed.memberId, parsed.snapshot);
    }

    if (seen.size !== batch.length) {
      logJobApplicationError("application_team_member_snapshot_missing", undefined, {
        memberCount: batch.length,
      });
      return { ok: false };
    }
  }

  return { ok: true, rows };
}

function applicationTeamMemberSnapshotFromRow(
  value: unknown,
): ApplicationTeamMemberSnapshot | null {
  if (!isRecord(value)) return null;
  const memberId = cleanText(value.id).toLowerCase();
  const applicationId = cleanText(value.application_id).toLowerCase();
  const jobPostId = cleanText(value.job_post_id).toLowerCase();
  const capturedAt = databaseTimestamp(value.captured_at);
  const expiresAt = databaseTimestamp(value.expires_at);
  const purgedAt = optionalDatabaseTimestamp(value.purged_at);
  if (
    !isUuid(memberId) ||
    !isUuid(applicationId) ||
    !isUuid(jobPostId) ||
    !isRecord(value.candidate_snapshot) ||
    !isRecord(value.media_snapshot) ||
    !capturedAt ||
    !expiresAt ||
    purgedAt === undefined
  ) {
    return null;
  }

  return {
    memberId,
    applicationId,
    jobPostId,
    snapshot:
      purgedAt === null && Date.parse(expiresAt) > Date.now()
        ? {
            application_id: applicationId,
            candidate_snapshot: value.candidate_snapshot,
            media_snapshot: value.media_snapshot,
            captured_at: capturedAt,
            expires_at: expiresAt,
            purged_at: null,
          }
        : undefined,
  };
}

function employerMemberFromSnapshot(
  member: ApplicationTeamMemberRow,
  snapshot?: ApplicationSnapshotRow,
): EmployerJobApplicationMember {
  const candidate = recordValue(snapshot?.candidate_snapshot);
  const media = recordValue(snapshot?.media_snapshot);
  const profile = recordValue(candidate.profile);
  const experiences = recordArray(candidate.experiences) as CompletionExperience[];
  const discoveryNotes = cleanText(profile.notes);
  const discovery = parseCrewDiscoverySettings(discoveryNotes);
  const completionPercent = calculateCrewProfileCompletion({ profile, experiences });
  const mediaOwnerIds = applicationMemberMediaOwnerIds(member);
  const avatarSource =
    snapshot && mediaOwnerIds.length
      ? safeOwnedPublicMediaUrl(media.avatar_source, mediaOwnerIds)
      : "";
  const avatarRevision = employerApplicationMediaRevision(
    snapshot?.captured_at || "",
    avatarSource,
  );

  return {
    id: member.id,
    applicantRole: member.memberRole,
    isPrimary: member.isPrimary,
    candidate: {
      displayName: maskedPersonName(member.memberName),
      initials: personInitials(member.memberName),
      profilePhotoUrl:
        avatarSource && avatarRevision
          ? buildEmployerApplicationMediaUrl({
              jobPostId: member.jobPostId,
              applicationId: member.applicationId,
              memberId: member.id,
              kind: "avatar",
              revision: avatarRevision,
            })
          : "",
      currentPosition:
        publicStructuredStringArray(profile.current_positions, 1, 120)[0] ||
        publicStructuredProfileField(profile.current_position, 120) ||
        member.memberPosition,
      nationality: publicStructuredProfileField(profile.nationality, 80),
      availabilityStatus: discoveryNotes.startsWith(crewDiscoveryNotesPrefix)
        ? discovery.availabilityStatus
        : "",
      experienceYears: crewExperienceYears(experiences),
      cvCompletionPercent: completionPercent,
      premiumProfile: isPremiumCrewProfile(completionPercent),
    },
  };
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
  const applicationMode = value.application_mode;
  const status = value.status;
  const submittedAt = databaseTimestamp(value.submitted_at);
  const updatedAt = databaseTimestamp(value.updated_at);
  const withdrawnAt = optionalDatabaseTimestamp(value.withdrawn_at);
  const version = value.version;

  if (
    !isUuid(id) ||
    !isUuid(jobPostId) ||
    !isJobApplicationMode(applicationMode) ||
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
    applicationMode,
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
  members: EmployerJobApplicationMember[],
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

  const primary = members.find((member) => member.isPrimary);
  if (
    !primary ||
    members.filter((member) => member.isPrimary).length !== 1 ||
    primary.applicantRole !== applicantRole ||
    (application.applicationMode === "individual" && members.length !== 1) ||
    (application.applicationMode === "team_couple" &&
      (members.length < 2 || members.length > 8))
  ) {
    return null;
  }

  return {
    ...application,
    coverNote: "",
    applicantRole,
    privateNoteAvailable: Boolean(application.coverNote),
    candidate: primary.candidate,
    members,
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
  memberId: string,
  isPrimaryMember: boolean,
  fullName: string,
  currentPosition: string,
): EmployerJobApplicationDetails {
  return {
    applicationId,
    memberId,
    isPrimaryMember,
    candidate: {
      displayName: maskedPersonName(fullName),
      initials: personInitials(fullName),
      profilePhotoUrl: "",
      currentPosition,
      nationality: "",
      location: "",
      gender: "",
      maritalStatus: "",
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
