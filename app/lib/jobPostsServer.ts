import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  isJobEmploymentType,
  isJobCandidateType,
  isJobRequiredLanguage,
  isJobSmokerPolicy,
  isJobVisibleTattooPolicy,
  isJobClosureReason,
  isSupportedJobListingNumber,
  isJobPostStatus,
  isJobSalaryCurrency,
  isJobSalaryPeriod,
  isJobMinimumYachtExperience,
  isJobYachtLengthUnit,
  isJobYachtType,
  type EmployerJobPost,
  type JobEmploymentType,
  type JobCandidateType,
  type JobRequiredLanguage,
  type JobSmokerPolicy,
  type JobVisibleTattooPolicy,
  type JobPostStatus,
  type JobSalaryCurrency,
  type JobSalaryPeriod,
  type JobMinimumYachtExperience,
  type JobYachtLengthUnit,
  type JobYachtType,
  type PublicJobPost,
  type VerifiedEmployerYacht,
} from "./jobPosts";
import {
  cleanText,
  isRecord,
  isUuid,
} from "./employerAccessServer";
import {
  marketplaceCapabilitiesForRole,
  type MarketplaceAccountRole,
  type MarketplaceCapabilities,
} from "./marketplaceCapabilities";
import {
  isMarketplaceSchemaUnavailable,
  loadOrEnsureMarketplaceEntitlement,
  type MarketplaceEntitlement,
} from "./marketplaceEntitlementsServer";
import { getPosition } from "./yachtOperations";
import { resolveSupabaseUrl } from "./supabaseConfig";

export const maximumJobPostRequestBytes = 32_768;
export const maximumPublicJobResults = 100;

export const publicJobPostSelect =
  "id,listing_number,title,position,department,employment_type,candidate_type,smoker_policy,visible_tattoo_policy,required_languages,yacht_type,yacht_length,yacht_length_unit,crew_member_count,minimum_yacht_experience,location,start_date,summary,description,responsibilities,requirements,benefits,salary_visible,salary_min,salary_max,salary_currency,salary_period,show_yacht_name,published_at,yacht:yachts(name,model,flag)";
export const publicJobPostServiceSelect =
  `${publicJobPostSelect},yacht_id,created_by`;

export const employerJobPostSelect =
  `${publicJobPostSelect},yacht_id,status,version,closes_at,closure_reason,closed_at,created_at,updated_at`;

const createPayloadKeys = new Set([
  "yachtId",
  "title",
  "position",
  "yachtType",
  "yachtLength",
  "yachtLengthUnit",
  "crewMemberCount",
  "minimumYachtExperience",
  "minimumYachtExperienceYears",
  "employmentType",
  "candidateType",
  "smokerPolicy",
  "visibleTattooPolicy",
  "requiredLanguages",
  "location",
  "startDate",
  "summary",
  "description",
  "responsibilities",
  "requirements",
  "benefits",
  "salaryVisible",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "salaryPeriod",
  "showYachtName",
  "status",
]);

const updatePayloadKeys = new Set([
  ...createPayloadKeys,
  "version",
]);
updatePayloadKeys.delete("yachtId");

export type JobPostMutation = {
  yachtId: string;
  title: string;
  position: string;
  department: string;
  employmentType: JobEmploymentType;
  candidateType: JobCandidateType;
  smokerPolicy: JobSmokerPolicy;
  visibleTattooPolicy: JobVisibleTattooPolicy;
  requiredLanguages: JobRequiredLanguage[];
  yachtType: JobYachtType | null;
  yachtLength: number | null;
  yachtLengthUnit: JobYachtLengthUnit | null;
  crewMemberCount: number | null;
  minimumYachtExperience: JobMinimumYachtExperience | null;
  location: string;
  startDate: string | null;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  salaryVisible: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: JobSalaryCurrency;
  salaryPeriod: JobSalaryPeriod;
  showYachtName: boolean;
  status: JobPostStatus;
  version: number | null;
};

type ParsedMutation =
  | { ok: true; data: JobPostMutation }
  | { ok: false; error: string };

type ServiceClientResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string };

type ReadBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string; status: number };

type AuthorityResult =
  | { ok: true; yacht: VerifiedEmployerYacht }
  | { ok: false; error: string; status: number };

type JobManagementAuthorityResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export type JobPostingWorkspaceCapabilities = MarketplaceCapabilities & {
  postingStatus: "enabled" | "suspended" | "unavailable";
  planCode: string;
};

export type JobPostingWorkspaceAuthority =
  | {
      ok: true;
      capabilities: JobPostingWorkspaceCapabilities;
      yachts: VerifiedEmployerYacht[];
    }
  | { ok: false; error: string; status: number };

type CurrentPublicAuthorityResult =
  | { ok: true; jobPostIds: Set<string> }
  | { ok: false; error: string };

export function jobPostServiceClient(): ServiceClientResult {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logJobPostError("configuration_missing");
    return {
      ok: false,
      error: "The job board is temporarily unavailable.",
    };
  }

  return {
    ok: true,
    client: createClient(resolveSupabaseUrl(supabaseUrl), serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function readJobPostBody(
  request: NextRequest,
): Promise<ReadBodyResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      error: "The request must use JSON.",
      status: 415,
    };
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumJobPostRequestBytes
  ) {
    return {
      ok: false,
      error: "The job post request is too large.",
      status: 413,
    };
  }

  try {
    const text = await request.text();
    if (
      new TextEncoder().encode(text).byteLength > maximumJobPostRequestBytes
    ) {
      return {
        ok: false,
        error: "The job post request is too large.",
        status: 413,
      };
    }

    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) {
      return {
        ok: false,
        error: "The job post request must be an object.",
        status: 400,
      };
    }

    return { ok: true, value };
  } catch {
    return {
      ok: false,
      error: "The job post request contains invalid JSON.",
      status: 400,
    };
  }
}

export function parseJobPostMutation(
  value: Record<string, unknown>,
  mode: "create" | "update",
  yachtIdFallback = "",
): ParsedMutation {
  const allowedKeys = mode === "create" ? createPayloadKeys : updatePayloadKeys;
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return { ok: false, error: "The request contains unsupported fields." };
  }

  const yachtId =
    mode === "create" ? cleanText(value.yachtId) : yachtIdFallback;
  if (!isUuid(yachtId)) {
    return { ok: false, error: "Select a valid yacht." };
  }

  const positionValue = strictText(value.position, 80);
  const position = positionValue ? getPosition(positionValue) : undefined;
  if (!position) {
    return { ok: false, error: "Select a valid yacht position." };
  }

  if (!isJobEmploymentType(value.employmentType)) {
    return { ok: false, error: "Select a valid employment type." };
  }
  if (!isJobCandidateType(value.candidateType)) {
    return { ok: false, error: "Select a valid Team / Couple option." };
  }
  if (!isJobSmokerPolicy(value.smokerPolicy)) {
    return { ok: false, error: "Select a valid smoking preference." };
  }
  if (!isJobVisibleTattooPolicy(value.visibleTattooPolicy)) {
    return { ok: false, error: "Select a valid visible tattoo preference." };
  }
  const yachtType = optionalJobYachtType(value.yachtType);
  const yachtLength = optionalYachtLength(value.yachtLength);
  const yachtLengthUnit = optionalJobYachtLengthUnit(value.yachtLengthUnit);
  const crewMemberCount = optionalCrewMemberCount(value.crewMemberCount);
  const minimumYachtExperience =
    value.minimumYachtExperience === undefined
      ? legacyJobMinimumYachtExperience(value.minimumYachtExperienceYears)
      : optionalJobMinimumYachtExperience(value.minimumYachtExperience);
  if (
    yachtType === undefined ||
    !yachtLength.ok ||
    yachtLengthUnit === undefined ||
    (yachtLength.value === null) !== (yachtLengthUnit === null) ||
    !crewMemberCount.ok ||
    minimumYachtExperience === undefined
  ) {
    return {
      ok: false,
      error:
        "Select a valid yacht type, length, measurement unit and minimum experience.",
    };
  }
  if (!isJobPostStatus(value.status)) {
    return { ok: false, error: "Select a valid job post status." };
  }
  if (!isJobSalaryCurrency(value.salaryCurrency)) {
    return { ok: false, error: "Select a supported salary currency." };
  }
  if (!isJobSalaryPeriod(value.salaryPeriod)) {
    return { ok: false, error: "Select a valid salary period." };
  }
  if (
    typeof value.salaryVisible !== "boolean" ||
    typeof value.showYachtName !== "boolean"
  ) {
    return {
      ok: false,
      error: "Salary and yacht visibility settings are invalid.",
    };
  }

  const title = strictText(value.title, 120, true);
  const location = strictText(value.location, 120, true);
  const summary = strictText(value.summary, 320, true);
  const description = strictText(value.description, 8000, true);
  if (
    title === null ||
    location === null ||
    summary === null ||
    description === null
  ) {
    return {
      ok: false,
      error: "One or more job post fields exceed the allowed length.",
    };
  }
  if (!title || !location) {
    return {
      ok: false,
      error: "Add a public title and location before saving the job post.",
    };
  }

  const startDate = optionalDate(value.startDate);
  if (!startDate.ok) {
    return { ok: false, error: "Enter a valid start date." };
  }
  const responsibilities = textList(value.responsibilities);
  const requirements = textList(value.requirements);
  const benefits = textList(value.benefits);
  const requiredLanguages = jobRequiredLanguageList(value.requiredLanguages);
  if (
    !responsibilities.ok ||
    !requirements.ok ||
    !benefits.ok
  ) {
    return {
      ok: false,
      error:
        "Use no more than 20 concise items in each list.",
    };
  }
  if (!requiredLanguages.ok) {
    return {
      ok: false,
      error: "Select required languages from the available options.",
    };
  }

  const salaryMin = optionalMoney(value.salaryMin);
  const salaryMax = optionalMoney(value.salaryMax);
  if (!salaryMin.ok || !salaryMax.ok) {
    return {
      ok: false,
      error: "Salary values must be positive numbers below 100,000,000.",
    };
  }
  if (
    salaryMin.value !== null &&
    salaryMax.value !== null &&
    salaryMin.value > salaryMax.value
  ) {
    return {
      ok: false,
      error: "The maximum salary cannot be lower than the minimum.",
    };
  }
  if (
    value.salaryVisible &&
    salaryMin.value === null &&
    salaryMax.value === null
  ) {
    return {
      ok: false,
      error: "Add a salary amount before making compensation public.",
    };
  }

  if (
    value.status === "published" &&
    (yachtType === null ||
      yachtLength.value === null ||
      yachtLengthUnit === null ||
      title.length < 3 ||
      location.length < 2 ||
      description.length < 60)
  ) {
    return {
      ok: false,
      error:
        "Complete the yacht type, yacht length, title, location and description before publishing.",
    };
  }

  let version: number | null = null;
  if (mode === "update") {
    if (
      typeof value.version !== "number" ||
      !Number.isSafeInteger(value.version) ||
      value.version < 1
    ) {
      return {
        ok: false,
        error: "Refresh this job post before saving it again.",
      };
    }
    version = value.version;
  }

  return {
    ok: true,
    data: {
      yachtId,
      title,
      position: position.title,
      department: position.department,
      employmentType: value.employmentType,
      candidateType: value.candidateType,
      smokerPolicy: value.smokerPolicy,
      visibleTattooPolicy: value.visibleTattooPolicy,
      requiredLanguages: requiredLanguages.value,
      yachtType,
      yachtLength: yachtLength.value,
      yachtLengthUnit,
      crewMemberCount: crewMemberCount.value,
      minimumYachtExperience,
      location,
      startDate: startDate.value,
      summary,
      description,
      responsibilities: responsibilities.value,
      requirements: requirements.value,
      benefits: benefits.value,
      salaryVisible: value.salaryVisible,
      salaryMin: salaryMin.value,
      salaryMax: salaryMax.value,
      salaryCurrency: value.salaryCurrency,
      salaryPeriod: value.salaryPeriod,
      showYachtName: value.showYachtName,
      status: value.status,
      version,
    },
  };
}

export async function verifyJobPostingAuthority(
  client: SupabaseClient,
  userId: string,
  yachtId: string,
): Promise<AuthorityResult> {
  const workspace = await loadJobPostingWorkspaceAuthority(client, userId);
  if (!workspace.ok) return workspace;

  const yacht = workspace.yachts.find((candidate) => candidate.id === yachtId);
  if (!workspace.capabilities.canPostJobs || !yacht) {
    return {
      ok: false,
      error:
        workspace.capabilities.postingStatus === "suspended"
          ? "Job posting is paused for this account."
          : "A current owner, captain or management relationship to the selected yacht is required.",
      status: 403,
    };
  }

  return { ok: true, yacht };
}

export async function verifyJobManagementAuthority(
  client: SupabaseClient,
  userId: string,
  jobPostId: string,
  yachtId: string,
): Promise<JobManagementAuthorityResult> {
  const response = await client.rpc("bluedeck_can_manage_job", {
    p_actor_user_id: userId,
    p_job_post_id: jobPostId,
  });

  if (response.error) {
    if (isMarketplaceSchemaUnavailable(response.error)) {
      const legacyAuthority = await verifyJobPostingAuthority(
        client,
        userId,
        yachtId,
      );
      return legacyAuthority.ok ? { ok: true } : legacyAuthority;
    }

    logJobPostError("job_management_authority_failed", response.error, {
      actorUserId: userId,
      jobPostId,
      yachtId,
    });
    return {
      ok: false,
      error: "Job management access could not be verified.",
      status: 500,
    };
  }

  if (response.data !== true) {
    return {
      ok: false,
      error:
        "A current owner, captain or management relationship is required to manage this job post.",
      status: 403,
    };
  }

  return { ok: true };
}

export async function loadJobPostingWorkspaceAuthority(
  client: SupabaseClient,
  userId: string,
): Promise<JobPostingWorkspaceAuthority> {
  const [entitlementResult, ownedYachtsResponse, legacyAccessResponse] =
    await Promise.all([
      loadOrEnsureMarketplaceEntitlement(client, userId),
      client
        .from("yachts")
        .select("id,name,model,flag,owner_id,created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      client
        .from("employer_access")
        .select("yacht_id,requested_role,status,can_post_jobs")
        .eq("user_id", userId)
        .eq("status", "verified")
        .eq("can_post_jobs", true),
    ]);

  if (ownedYachtsResponse.error || legacyAccessResponse.error) {
    logJobPostError(
      "workspace_authority_lookup_failed",
      ownedYachtsResponse.error || legacyAccessResponse.error,
      { actorUserId: userId },
    );
    return {
      ok: false,
      error: "Your job posting workspace could not be loaded.",
      status: 500,
    };
  }

  if (!entitlementResult.ok && !entitlementResult.schemaUnavailable) {
    logJobPostError("marketplace_entitlement_lookup_failed", entitlementResult.error, {
      actorUserId: userId,
    });
    return {
      ok: false,
      error: "Your marketplace access could not be verified.",
      status: 500,
    };
  }

  const ownedYachts = (ownedYachtsResponse.data || [])
    .map(verifiedYachtFromRow)
    .filter((yacht): yacht is VerifiedEmployerYacht => Boolean(yacht));
  const ownedYachtsById = new Map(ownedYachts.map((yacht) => [yacht.id, yacht]));
  const legacyAccessRows = legacyAccessResponse.data || [];
  const legacyYachtIds = new Set(
    legacyAccessRows
      .map((row) => cleanText(row.yacht_id))
      .filter((id) => isUuid(id)),
  );

  if (!entitlementResult.ok || !entitlementResult.entitlement) {
    const yachts = ownedYachts.filter((yacht) => legacyYachtIds.has(yacht.id));
    const legacyRole = legacyMarketplaceRole(legacyAccessRows);
    const roleCapabilities = marketplaceCapabilitiesForRole(legacyRole);
    return {
      ok: true,
      capabilities: {
        ...roleCapabilities,
        canPostJobs: yachts.length > 0 && roleCapabilities.canPostJobs,
        postingStatus: yachts.length > 0 ? "enabled" : "unavailable",
        planCode: "legacy",
      },
      yachts,
    };
  }

  const entitlement = entitlementResult.entitlement;
  if (!entitlement.canPostJobs) {
    return {
      ok: true,
      capabilities: workspaceCapabilities(entitlement),
      yachts: [],
    };
  }

  const yachtsById = new Map(ownedYachtsById);
  if (entitlement.role === "captain" || entitlement.role === "management") {
    const memberYachtsResult = await loadActiveMembershipYachts(client, userId);
    if (!memberYachtsResult.ok) {
      logJobPostError("membership_yacht_authority_load_failed", memberYachtsResult.error, {
        actorUserId: userId,
      });
      return {
        ok: false,
        error: "Your connected yachts could not be loaded.",
        status: 500,
      };
    }
    for (const yacht of memberYachtsResult.yachts) {
      yachtsById.set(yacht.id, yacht);
    }
  }

  const authorizedYachts = await filterYachtsByMarketplaceAuthority(
    client,
    userId,
    [...yachtsById.values()],
  );
  if (!authorizedYachts.ok) {
    logJobPostError("database_marketplace_authority_load_failed", authorizedYachts.error, {
      actorUserId: userId,
    });
    return {
      ok: false,
      error: "Your yacht marketplace authority could not be verified.",
      status: 500,
    };
  }

  return {
    ok: true,
    capabilities: workspaceCapabilities(entitlement),
    yachts: authorizedYachts.yachts,
  };
}

async function filterYachtsByMarketplaceAuthority(
  client: SupabaseClient,
  userId: string,
  yachts: VerifiedEmployerYacht[],
): Promise<
  | { ok: true; yachts: VerifiedEmployerYacht[] }
  | { ok: false; error: unknown }
> {
  const allowed = new Set<string>();

  for (let index = 0; index < yachts.length; index += 12) {
    const batch = yachts.slice(index, index + 12);
    const results = await Promise.all(
      batch.map(async (yacht) => ({
        yacht,
        response: await client.rpc("bluedeck_can_manage_yacht_marketplace", {
          p_actor_user_id: userId,
          p_yacht_id: yacht.id,
        }),
      })),
    );

    for (const result of results) {
      if (result.response.error) {
        return { ok: false, error: result.response.error };
      }
      if (result.response.data === true) allowed.add(result.yacht.id);
    }
  }

  return {
    ok: true,
    yachts: yachts.filter((yacht) => allowed.has(yacht.id)),
  };
}

async function loadActiveMembershipYachts(
  client: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; yachts: VerifiedEmployerYacht[] }
  | { ok: false; error: unknown }
> {
  const profilesResponse = await client
    .from("crew_profiles")
    .select("id")
    .eq("user_id", userId);

  if (profilesResponse.error) {
    return { ok: false, error: profilesResponse.error };
  }

  const profileIds = (profilesResponse.data || [])
    .map((row) => cleanText(row.id))
    .filter((id) => isUuid(id));
  if (profileIds.length === 0) return { ok: true, yachts: [] };

  const membershipsResponse = await client
    .from("yacht_crew_memberships")
    .select("yacht_id")
    .in("crew_profile_id", profileIds)
    .eq("status", "active");

  if (membershipsResponse.error) {
    return { ok: false, error: membershipsResponse.error };
  }

  const yachtIds = [
    ...new Set(
      (membershipsResponse.data || [])
        .map((row) => cleanText(row.yacht_id))
        .filter((id) => isUuid(id)),
    ),
  ];
  if (yachtIds.length === 0) return { ok: true, yachts: [] };

  const yachtsResponse = await client
    .from("yachts")
    .select("id,name,model,flag")
    .in("id", yachtIds);

  if (yachtsResponse.error) {
    return { ok: false, error: yachtsResponse.error };
  }

  return {
    ok: true,
    yachts: (yachtsResponse.data || [])
      .map(verifiedYachtFromRow)
      .filter((yacht): yacht is VerifiedEmployerYacht => Boolean(yacht)),
  };
}

function workspaceCapabilities(
  entitlement: MarketplaceEntitlement,
): JobPostingWorkspaceCapabilities {
  return {
    role: entitlement.role,
    canPostJobs: entitlement.canPostJobs,
    canApplyJobs: entitlement.canApplyJobs,
    requiresAdminApproval: false,
    postingStatus: entitlement.postingStatus,
    planCode: entitlement.planCode,
  };
}

function legacyMarketplaceRole(rows: unknown[]): MarketplaceAccountRole {
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const requestedRole = cleanText(row.requested_role).toLowerCase();
    if (
      requestedRole === "captain" ||
      requestedRole === "owner" ||
      requestedRole === "management"
    ) {
      return requestedRole;
    }
  }
  return "crew";
}

export async function currentPublicJobPostIds(
  client: SupabaseClient,
  rows: unknown[],
): Promise<CurrentPublicAuthorityResult> {
  const authorityRows: Array<{
    jobPostId: string;
    yachtId: string;
    createdBy: string;
  }> = [];

  for (const value of rows) {
    if (!isRecord(value)) {
      return { ok: false, error: "Invalid job post authority record." };
    }
    const jobPostId = cleanText(value.id);
    const yachtId = cleanText(value.yacht_id);
    const createdBy = cleanText(value.created_by);
    if (!isUuid(jobPostId) || !isUuid(yachtId) || !isUuid(createdBy)) {
      return { ok: false, error: "Invalid job post authority record." };
    }
    authorityRows.push({ jobPostId, yachtId, createdBy });
  }

  if (authorityRows.length === 0) {
    return { ok: true, jobPostIds: new Set() };
  }

  const yachtIds = [...new Set(authorityRows.map((row) => row.yachtId))];
  const creatorIds = [...new Set(authorityRows.map((row) => row.createdBy))];
  const [yachtsResponse, accessResponse] = await Promise.all([
    client
      .from("yachts")
      .select("id,owner_id")
      .in("id", yachtIds),
    client
      .from("employer_access")
      .select("user_id,yacht_id,status,can_post_jobs")
      .in("yacht_id", yachtIds)
      .in("user_id", creatorIds)
      .eq("status", "verified")
      .eq("can_post_jobs", true),
  ]);

  if (yachtsResponse.error || accessResponse.error) {
    logJobPostError(
      "current_public_authority_load_failed",
      yachtsResponse.error || accessResponse.error,
    );
    return {
      ok: false,
      error: "Current employer authority could not be verified.",
    };
  }

  const ownerPairs = new Set<string>();
  for (const yacht of yachtsResponse.data || []) {
    const yachtId = cleanText(yacht.id);
    const ownerId = cleanText(yacht.owner_id);
    if (isUuid(yachtId) && isUuid(ownerId)) {
      ownerPairs.add(authorityPair(yachtId, ownerId));
    }
  }

  const accessPairs = new Set<string>();
  for (const access of accessResponse.data || []) {
    const yachtId = cleanText(access.yacht_id);
    const userId = cleanText(access.user_id);
    if (
      isUuid(yachtId) &&
      isUuid(userId) &&
      access.status === "verified" &&
      access.can_post_jobs === true
    ) {
      accessPairs.add(authorityPair(yachtId, userId));
    }
  }

  const authorityPairs = [
    ...new Map(
      authorityRows.map((row) => [
        authorityPair(row.yachtId, row.createdBy),
        { yachtId: row.yachtId, userId: row.createdBy },
      ]),
    ).values(),
  ];
  const marketplacePairs = new Set<string>();
  let marketplaceFunctionUnavailable = false;

  for (let index = 0; index < authorityPairs.length; index += 12) {
    const batch = authorityPairs.slice(index, index + 12);
    const results = await Promise.all(
      batch.map(async (pair) => ({
        pair,
        response: await client.rpc("bluedeck_can_manage_yacht_marketplace", {
          p_actor_user_id: pair.userId,
          p_yacht_id: pair.yachtId,
        }),
      })),
    );

    for (const result of results) {
      if (result.response.error) {
        if (isMarketplaceSchemaUnavailable(result.response.error)) {
          marketplaceFunctionUnavailable = true;
          break;
        }
        logJobPostError(
          "current_public_marketplace_authority_failed",
          result.response.error,
        );
        return {
          ok: false,
          error: "Current employer authority could not be verified.",
        };
      }
      if (result.response.data === true) {
        marketplacePairs.add(
          authorityPair(result.pair.yachtId, result.pair.userId),
        );
      }
    }

    if (marketplaceFunctionUnavailable) break;
  }

  const jobPostIds = new Set<string>();
  for (const row of authorityRows) {
    const pair = authorityPair(row.yachtId, row.createdBy);
    const currentlyAuthorized = marketplaceFunctionUnavailable
      ? ownerPairs.has(pair) && accessPairs.has(pair)
      : marketplacePairs.has(pair);

    if (currentlyAuthorized) {
      jobPostIds.add(row.jobPostId);
    }
  }

  return { ok: true, jobPostIds };
}

export function publicJobPostFromRow(value: unknown): PublicJobPost | null {
  const base = jobPostBaseFromRow(value);
  if (!base || !base.publishedAt) return null;

  return {
    id: base.id,
    listingNumber: base.listingNumber,
    title: base.title,
    position: base.position,
    department: base.department,
    employmentType: base.employmentType,
    candidateType: base.candidateType,
    smokerPolicy: base.smokerPolicy,
    visibleTattooPolicy: base.visibleTattooPolicy,
    requiredLanguages: base.requiredLanguages,
    yachtType: base.yachtType,
    yachtLength: base.yachtLength,
    yachtLengthUnit: base.yachtLengthUnit,
    crewMemberCount: base.crewMemberCount,
    minimumYachtExperience: base.minimumYachtExperience,
    location: base.location,
    startDate: base.startDate,
    summary: base.summary,
    description: base.description,
    responsibilities: base.responsibilities,
    requirements: base.requirements,
    benefits: base.benefits,
    salary: base.salaryVisible ? base.salary : null,
    yacht: base.showYachtName
      ? base.yacht
      : { name: "", model: null, flag: null },
    publishedAt: base.publishedAt,
  };
}

export function employerJobPostFromRow(value: unknown): EmployerJobPost | null {
  const base = jobPostBaseFromRow(value);
  if (!base || !isRecord(value)) return null;

  const yachtId = cleanText(value.yacht_id);
  const createdAt = timestamp(value.created_at);
  const updatedAt = timestamp(value.updated_at);
  const expiresAt = optionalDatabaseTimestamp(value.closes_at);
  const closureReason =
    value.closure_reason === null
      ? null
      : isJobClosureReason(value.closure_reason)
        ? value.closure_reason
        : undefined;
  const closedAt = optionalDatabaseTimestamp(value.closed_at);

  if (
    !isUuid(yachtId) ||
    !isJobPostStatus(value.status) ||
    typeof value.version !== "number" ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    !createdAt ||
    !updatedAt ||
    expiresAt === undefined ||
    closureReason === undefined ||
    closedAt === undefined
  ) {
    return null;
  }

  if (
    (value.status === "draft" &&
      (base.publishedAt !== null ||
        expiresAt !== null ||
        closureReason !== null ||
        closedAt !== null)) ||
    (value.status === "published" &&
      (base.publishedAt === null ||
        expiresAt === null ||
        closureReason !== null ||
        closedAt !== null)) ||
    (value.status === "closed" &&
      (closureReason === null || closedAt === null))
  ) {
    return null;
  }

  return {
    id: base.id,
    listingNumber: base.listingNumber,
    yachtId,
    title: base.title,
    position: base.position,
    department: base.department,
    employmentType: base.employmentType,
    candidateType: base.candidateType,
    smokerPolicy: base.smokerPolicy,
    visibleTattooPolicy: base.visibleTattooPolicy,
    requiredLanguages: base.requiredLanguages,
    yachtType: base.yachtType,
    yachtLength: base.yachtLength,
    yachtLengthUnit: base.yachtLengthUnit,
    crewMemberCount: base.crewMemberCount,
    minimumYachtExperience: base.minimumYachtExperience,
    location: base.location,
    startDate: base.startDate,
    summary: base.summary,
    description: base.description,
    responsibilities: base.responsibilities,
    requirements: base.requirements,
    benefits: base.benefits,
    salary: base.salary,
    salaryVisible: base.salaryVisible,
    showYachtName: base.showYachtName,
    yacht: base.yacht,
    status: value.status,
    version: value.version,
    publishedAt: base.publishedAt,
    expiresAt,
    closureReason,
    closedAt,
    createdAt,
    updatedAt,
  };
}

export function verifiedYachtFromRow(
  value: unknown,
): VerifiedEmployerYacht | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id);
  if (!isUuid(id)) return null;

  return {
    id,
    name: cleanText(value.name) || "BlueDeck yacht",
    model: cleanText(value.model) || null,
    flag: cleanText(value.flag) || null,
  };
}

export function jobPostMutationColumns(
  mutation: JobPostMutation,
): Record<string, unknown> {
  return {
    title: mutation.title,
    position: mutation.position,
    department: mutation.department,
    employment_type: mutation.employmentType,
    candidate_type: mutation.candidateType,
    smoker_policy: mutation.smokerPolicy,
    visible_tattoo_policy: mutation.visibleTattooPolicy,
    required_languages: mutation.requiredLanguages,
    yacht_type: mutation.yachtType,
    yacht_length: mutation.yachtLength,
    yacht_length_unit: mutation.yachtLengthUnit,
    crew_member_count: mutation.crewMemberCount,
    minimum_yacht_experience: mutation.minimumYachtExperience,
    location: mutation.location,
    start_date: mutation.startDate,
    summary: mutation.summary,
    description: mutation.description,
    responsibilities: mutation.responsibilities,
    requirements: mutation.requirements,
    benefits: mutation.benefits,
    salary_visible: mutation.salaryVisible,
    salary_min: mutation.salaryMin,
    salary_max: mutation.salaryMax,
    salary_currency: mutation.salaryCurrency,
    salary_period: mutation.salaryPeriod,
    show_yacht_name: mutation.showYachtName,
    status: mutation.status,
  };
}

export function logJobPostError(
  event: string,
  error?: unknown,
  context: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error("[job-posts]", {
    event,
    ...context,
    error: safeError(error),
  });
}

function jobPostBaseFromRow(value: unknown) {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id);
  const listingNumber = cleanText(value.listing_number);
  const title = cleanText(value.title);
  const position = cleanText(value.position);
  const department = cleanText(value.department);
  const yachtType = databaseJobYachtType(value.yacht_type);
  const yachtLength = databaseYachtLength(value.yacht_length);
  const yachtLengthUnit = databaseJobYachtLengthUnit(value.yacht_length_unit);
  const crewMemberCount = databaseCrewMemberCount(value.crew_member_count);
  const minimumYachtExperience = databaseJobMinimumYachtExperience(
    value.minimum_yacht_experience,
  );
  const location = cleanText(value.location);
  const summary = cleanText(value.summary);
  const description = cleanText(value.description);
  const startDate = optionalDatabaseDate(value.start_date);
  const publishedAt = optionalDatabaseTimestamp(value.published_at);
  const responsibilities = databaseTextList(value.responsibilities);
  const requirements = databaseTextList(value.requirements);
  const benefits = databaseTextList(value.benefits);
  const requiredLanguages = databaseJobRequiredLanguageList(
    value.required_languages,
  );
  const salaryMin = databaseMoney(value.salary_min);
  const salaryMax = databaseMoney(value.salary_max);
  const joinedYacht = joinedRecord(value.yacht);

  if (
    !isUuid(id) ||
    !isSupportedJobListingNumber(listingNumber) ||
    !title ||
    !position ||
    !department ||
    yachtType === undefined ||
    yachtLength === undefined ||
    yachtLengthUnit === undefined ||
    (yachtLength === null) !== (yachtLengthUnit === null) ||
    crewMemberCount === undefined ||
    minimumYachtExperience === undefined ||
    !isJobEmploymentType(value.employment_type) ||
    !isJobCandidateType(value.candidate_type) ||
    !isJobSmokerPolicy(value.smoker_policy) ||
    !isJobVisibleTattooPolicy(value.visible_tattoo_policy) ||
    !location ||
    startDate === undefined ||
    publishedAt === undefined ||
    !responsibilities ||
    !requirements ||
    !benefits ||
    !requiredLanguages ||
    typeof value.salary_visible !== "boolean" ||
    salaryMin === undefined ||
    salaryMax === undefined ||
    !isJobSalaryCurrency(value.salary_currency) ||
    !isJobSalaryPeriod(value.salary_period) ||
    typeof value.show_yacht_name !== "boolean" ||
    !joinedYacht
  ) {
    return null;
  }

  return {
    id,
    listingNumber,
    title,
    position,
    department,
    employmentType: value.employment_type,
    candidateType: value.candidate_type,
    smokerPolicy: value.smoker_policy,
    visibleTattooPolicy: value.visible_tattoo_policy,
    requiredLanguages,
    yachtType,
    yachtLength,
    yachtLengthUnit,
    crewMemberCount,
    minimumYachtExperience,
    location,
    startDate,
    summary,
    description,
    responsibilities,
    requirements,
    benefits,
    salaryVisible: value.salary_visible,
    salary: {
      min: salaryMin,
      max: salaryMax,
      currency: value.salary_currency,
      period: value.salary_period,
    },
    showYachtName: value.show_yacht_name,
    yacht: {
      name: cleanText(joinedYacht.name) || "BlueDeck yacht",
      model: cleanText(joinedYacht.model) || null,
      flag: cleanText(joinedYacht.flag) || null,
    },
    publishedAt,
  };
}

function strictText(
  value: unknown,
  maximumLength: number,
  allowEmpty = false,
): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if ((!allowEmpty && !text) || text.length > maximumLength) return null;
  return text;
}

function textList(
  value: unknown,
): { ok: true; value: string[] } | { ok: false } {
  if (!Array.isArray(value) || value.length > 20) return { ok: false };

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return { ok: false };
    const text = item.trim();
    if (!text) continue;
    if (text.length > 320) return { ok: false };
    if (!result.includes(text)) result.push(text);
  }

  if (result.join("").length > 8000) return { ok: false };
  return { ok: true, value: result };
}

function jobRequiredLanguageList(
  value: unknown,
): { ok: true; value: JobRequiredLanguage[] } | { ok: false } {
  if (!Array.isArray(value) || value.length > 11) return { ok: false };

  const result: JobRequiredLanguage[] = [];
  for (const item of value) {
    if (!isJobRequiredLanguage(item)) return { ok: false };
    if (!result.includes(item)) result.push(item);
  }
  return { ok: true, value: result };
}

function databaseTextList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const text = item.trim();
    if (text) result.push(text);
  }
  return result;
}

function databaseJobRequiredLanguageList(
  value: unknown,
): JobRequiredLanguage[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const result: JobRequiredLanguage[] = [];
  for (const item of value) {
    if (isJobRequiredLanguage(item) && !result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

function optionalMoney(
  value: unknown,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 99_999_999.99
  ) {
    return { ok: false };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

function optionalJobYachtType(value: unknown): JobYachtType | null | undefined {
  if (value === null) return null;
  return isJobYachtType(value) ? value : undefined;
}

function optionalJobYachtLengthUnit(
  value: unknown,
): JobYachtLengthUnit | null | undefined {
  if (value === null) return null;
  return isJobYachtLengthUnit(value) ? value : undefined;
}

function optionalYachtLength(
  value: unknown,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  const rounded =
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value * 100) / 100
      : Number.NaN;
  if (
    !Number.isFinite(rounded) ||
    rounded <= 0 ||
    rounded > 1_000
  ) {
    return { ok: false };
  }
  return { ok: true, value: rounded };
}

function optionalCrewMemberCount(
  value: unknown,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 200
  ) {
    return { ok: false };
  }
  return { ok: true, value };
}

function optionalJobMinimumYachtExperience(
  value: unknown,
): JobMinimumYachtExperience | null | undefined {
  // Treat an omitted value like an empty optional field so an older browser
  // session can still save a listing after the server rollout.
  if (value === null || value === undefined) {
    return null;
  }
  return isJobMinimumYachtExperience(value) ? value : undefined;
}

function legacyJobMinimumYachtExperience(
  value: unknown,
): JobMinimumYachtExperience | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return undefined;
  }
  if (value === 0) return "0_6_months";
  if (value === 1) return "1_year";
  if (value === 2) return "2_years";
  if (value === 3) return "3_years";
  if (value <= 5) return "3_5_years";
  if (value <= 10) return "5_10_years";
  if (value < 15) return "10_plus_years";
  if (value < 20) return "15_plus_years";
  return "20_plus_years";
}

function databaseMoney(value: unknown): number | null | undefined {
  if (value === null) return null;
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function databaseJobYachtType(
  value: unknown,
): JobYachtType | null | undefined {
  if (value === null) return null;
  return isJobYachtType(value) ? value : undefined;
}

function databaseJobYachtLengthUnit(
  value: unknown,
): JobYachtLengthUnit | null | undefined {
  if (value === null) return null;
  return isJobYachtLengthUnit(value) ? value : undefined;
}

function databaseYachtLength(value: unknown): number | null | undefined {
  if (value === null) return null;
  const length =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(length) && length > 0 && length <= 1_000
    ? length
    : undefined;
}

function databaseCrewMemberCount(
  value: unknown,
): number | null | undefined {
  if (value === null) return null;
  const count =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(count) && count >= 1 && count <= 200
    ? count
    : undefined;
}

function databaseJobMinimumYachtExperience(
  value: unknown,
): JobMinimumYachtExperience | null | undefined {
  if (value === null) return null;
  return isJobMinimumYachtExperience(value) ? value : undefined;
}

function optionalDate(
  value: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false };
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? { ok: true, value }
    : { ok: false };
}

function optionalDatabaseDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  return value;
}

function optionalDatabaseTimestamp(
  value: unknown,
): string | null | undefined {
  if (value === null) return null;
  const result = timestamp(value);
  return result || undefined;
}

function timestamp(value: unknown) {
  const result = cleanText(value);
  return result && !Number.isNaN(Date.parse(result)) ? result : "";
}

function joinedRecord(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isRecord(candidate) ? candidate : null;
}

function authorityPair(yachtId: string, userId: string) {
  return `${yachtId}:${userId}`;
}

function safeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (!isRecord(error)) return { message: String(error) };
  return {
    code: cleanText(error.code) || undefined,
    message: cleanText(error.message) || "Unknown server error",
  };
}
