import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  isJobEmploymentType,
  isJobCandidateType,
  isJobCertificate,
  isJobCharacteristic,
  isJobRequiredLanguage,
  isJobSkill,
  isJobSmokerPolicy,
  isJobVisa,
  isJobVisibleTattooPolicy,
  isJobClosureReason,
  isSupportedJobListingNumber,
  isJobPostStatus,
  isJobSalaryCurrency,
  isJobSalaryPeriod,
  isJobMinimumYachtExperience,
  isJobYachtLengthUnit,
  isJobYachtProgram,
  isJobYachtType,
  maximumJobCertificateSelections,
  maximumJobCharacteristicSelections,
  maximumJobSalaryAmount,
  maximumJobSkillSelections,
  maximumJobVisaSelections,
  type EmployerJobPost,
  type JobEmploymentType,
  type JobCandidateType,
  type JobCertificate,
  type JobCharacteristic,
  type JobRequiredLanguage,
  type JobSkill,
  type JobSmokerPolicy,
  type JobVisa,
  type JobVisibleTattooPolicy,
  type JobPostStatus,
  type JobSalaryCurrency,
  type JobSalaryPeriod,
  type JobMinimumYachtExperience,
  type JobYachtLengthUnit,
  type JobYachtProgram,
  type JobYachtType,
  type PublicJobCard,
  type PublicJobPost,
} from "./jobPosts";
import { readLimitedJsonObjectDetailed } from "./requestBodyServer";
import {
  cleanText,
  isRecord,
  isUuid,
} from "./employerAccessServer";
import type { MarketplaceCapabilities } from "./marketplaceCapabilities";
import {
  loadOrEnsureMarketplaceEntitlement,
  type MarketplaceEntitlement,
} from "./marketplaceEntitlementsServer";
import { getPosition } from "./yachtOperations";
import { countryOptionFromCode } from "./countries";
import { resolveSupabaseUrl } from "./supabaseConfig";

export const maximumJobPostRequestBytes = 32_768;
export const maximumPublicJobResults = 100;

export const publicJobPostSelect =
  "id,listing_number,title,position,department,employment_type,candidate_type,smoker_policy,visible_tattoo_policy,required_languages,required_skills,required_characteristics,required_certificates,required_visas,yacht_brand,yacht_flag_country_code,yacht_build_year,yacht_type,yacht_program,yacht_length,yacht_length_unit,crew_member_count,minimum_yacht_experience,location,start_date,summary,description,responsibilities,requirements,benefits,salary_visible,salary_min,salary_max,salary_currency,salary_period,published_at";
export const publicJobPostServiceSelect =
  `${publicJobPostSelect},created_by`;

export const publicJobCardSelect =
  "id,position,employment_type,candidate_type,yacht_type,yacht_program,yacht_length,yacht_length_unit,location,start_date,salary_visible,salary_min,salary_max,salary_currency,salary_period,published_at";
export const publicJobCardServiceSelect = `${publicJobCardSelect},created_by`;

export const employerJobPostSelect =
  `${publicJobPostSelect},status,version,closes_at,closure_reason,closed_at,created_at,updated_at`;

const createPayloadKeys = new Set([
  "title",
  "position",
  "yachtBrand",
  "yachtFlagCountryCode",
  "yachtBuildYear",
  "yachtType",
  "yachtProgram",
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
  "requiredSkills",
  "requiredCharacteristics",
  "requiredCertificates",
  "requiredVisas",
  "location",
  "startDate",
  "summary",
  "description",
  "responsibilities",
  "requirements",
  "benefits",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "salaryPeriod",
  "status",
]);

const updatePayloadKeys = new Set([
  ...createPayloadKeys,
  "version",
]);

export type JobPostMutation = {
  title: string;
  position: string;
  department: string;
  employmentType: JobEmploymentType;
  candidateType: JobCandidateType;
  smokerPolicy: JobSmokerPolicy;
  visibleTattooPolicy: JobVisibleTattooPolicy;
  requiredLanguages: JobRequiredLanguage[];
  requiredSkills: JobSkill[];
  requiredCharacteristics: JobCharacteristic[];
  requiredCertificates: JobCertificate[];
  requiredVisas: JobVisa[];
  yachtBrand: string | null;
  yachtFlagCountryCode: string | null;
  yachtBuildYear: number | null;
  yachtType: JobYachtType | null;
  yachtProgram: JobYachtProgram | null | undefined;
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
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: JobSalaryCurrency;
  salaryPeriod: JobSalaryPeriod;
  status: JobPostStatus;
  version: number | null;
};

type ParsedMutation =
  | { ok: true; data: JobPostMutation }
  | { ok: false; error: string };

type ServiceClientResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string };

export type PublicJobPostLoadResult =
  | { ok: true; job: PublicJobPost }
  | { ok: false; error: string; status: 404 | 500 | 503 };

type ReadBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string; status: number };

type AuthorityResult =
  | { ok: true }
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

export async function loadPublicJobPost(
  jobPostId: string,
): Promise<PublicJobPostLoadResult> {
  const id = cleanText(jobPostId).toLowerCase();
  if (!isUuid(id)) {
    return { ok: false, error: "Job post not found.", status: 404 };
  }

  const service = jobPostServiceClient();
  if (!service.ok) {
    return { ok: false, error: service.error, status: 503 };
  }

  const now = new Date().toISOString();
  const { data, error } = await service.client
    .from("job_posts")
    .select(publicJobPostServiceSelect)
    .eq("id", id)
    .eq("status", "published")
    .lte("published_at", now)
    .gt("closes_at", now)
    .maybeSingle();

  if (error) {
    logJobPostError("public_detail_load_failed", error, { jobPostId: id });
    return {
      ok: false,
      error: "The job post could not be loaded.",
      status: 503,
    };
  }

  if (!data) {
    return { ok: false, error: "Job post not found.", status: 404 };
  }

  const currentAuthority = await currentPublicJobPostIds(
    service.client,
    [data],
  );
  if (!currentAuthority.ok) {
    logJobPostError("public_detail_authority_failed", currentAuthority.error, {
      jobPostId: id,
    });
    return {
      ok: false,
      error: "The job post could not be loaded.",
      status: 503,
    };
  }
  if (!currentAuthority.jobPostIds.has(id)) {
    return { ok: false, error: "Job post not found.", status: 404 };
  }

  const job = publicJobPostFromRow(data);
  if (!job) {
    logJobPostError("invalid_public_job_record", undefined, {
      jobPostId: id,
    });
    return {
      ok: false,
      error: "The job post could not be loaded.",
      status: 500,
    };
  }

  return { ok: true, job };
}

export async function readJobPostBody(
  request: NextRequest,
): Promise<ReadBodyResult> {
  const result = await readLimitedJsonObjectDetailed(
    request,
    maximumJobPostRequestBytes,
  );
  if (!result.ok && result.error === "content-type") {
    return {
      ok: false,
      error: "The request must use JSON.",
      status: 415,
    };
  }

  if (!result.ok && result.error === "too-large") {
    return {
      ok: false,
      error: "The job post request is too large.",
      status: 413,
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      error: "The job post request contains invalid JSON.",
      status: 400,
    };
  }
  return { ok: true, value: result.value };
}

export function parseJobPostMutation(
  value: Record<string, unknown>,
  mode: "create" | "update",
): ParsedMutation {
  const allowedKeys = mode === "create" ? createPayloadKeys : updatePayloadKeys;
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return { ok: false, error: "The request contains unsupported fields." };
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
  const yachtBrand = optionalStrictText(value.yachtBrand, 80);
  const yachtFlagCountryCode = optionalYachtFlagCountryCode(
    value.yachtFlagCountryCode,
  );
  const yachtBuildYear = optionalYachtBuildYear(value.yachtBuildYear);
  const yachtType = optionalJobYachtType(value.yachtType);
  const yachtProgramProvided = Object.hasOwn(value, "yachtProgram");
  const yachtProgram = yachtProgramProvided
    ? optionalJobYachtProgram(value.yachtProgram)
    : mode === "create"
      ? null
      : undefined;
  const yachtLength = optionalYachtLength(value.yachtLength);
  const yachtLengthUnit = optionalJobYachtLengthUnit(value.yachtLengthUnit);
  const crewMemberCount = optionalCrewMemberCount(value.crewMemberCount);
  const minimumYachtExperience =
    value.minimumYachtExperience === undefined
      ? legacyJobMinimumYachtExperience(value.minimumYachtExperienceYears)
      : optionalJobMinimumYachtExperience(value.minimumYachtExperience);
  if (
    yachtBrand === undefined ||
    yachtFlagCountryCode === undefined ||
    !yachtBuildYear.ok ||
    yachtType === undefined ||
    (yachtProgramProvided && yachtProgram === undefined) ||
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
  const title = position.title;
  const location = strictText(value.location, 120, true);
  const summary = strictText(value.summary, 320, true);
  const description = strictText(value.description, 8000, true);
  if (location === null || summary === null || description === null) {
    return {
      ok: false,
      error: "One or more job post fields exceed the allowed length.",
    };
  }
  if (!location) {
    return {
      ok: false,
      error: "Add a location before saving the job post.",
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
  const requiredSkills = jobOptionList(
    value.requiredSkills,
    maximumJobSkillSelections,
    isJobSkill,
  );
  const requiredCharacteristics = jobOptionList(
    value.requiredCharacteristics,
    maximumJobCharacteristicSelections,
    isJobCharacteristic,
  );
  const requiredCertificates = jobOptionList(
    value.requiredCertificates,
    maximumJobCertificateSelections,
    isJobCertificate,
  );
  const requiredVisas = jobOptionList(
    value.requiredVisas,
    maximumJobVisaSelections,
    isJobVisa,
  );
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
  if (
    !requiredSkills.ok ||
    !requiredCharacteristics.ok ||
    !requiredCertificates.ok ||
    !requiredVisas.ok
  ) {
    return {
      ok: false,
      error: "Select skills, characteristics, documents and visas from the available options.",
    };
  }

  const salaryMin = optionalMoney(value.salaryMin);
  const salaryMax = optionalMoney(value.salaryMax);
  if (!salaryMin.ok || !salaryMax.ok) {
    return {
      ok: false,
      error: "Salary values must be whole numbers between 0 and 1,000,000.",
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
    value.status === "published" &&
    (yachtType === null ||
      yachtLength.value === null ||
      yachtLengthUnit === null ||
      location.length < 2 ||
      startDate.value === null ||
      Math.max(salaryMin.value || 0, salaryMax.value || 0) <= 0 ||
      description.length < 60)
  ) {
    return {
      ok: false,
      error:
        "Complete the position, employment type, location, start date, salary, yacht type, yacht length and description before publishing.",
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
      title,
      position: position.title,
      department: position.department,
      employmentType: value.employmentType,
      candidateType: value.candidateType,
      smokerPolicy: value.smokerPolicy,
      visibleTattooPolicy: value.visibleTattooPolicy,
      requiredLanguages: requiredLanguages.value,
      requiredSkills: requiredSkills.value,
      requiredCharacteristics: requiredCharacteristics.value,
      requiredCertificates: requiredCertificates.value,
      requiredVisas: requiredVisas.value,
      yachtBrand,
      yachtFlagCountryCode,
      yachtBuildYear: yachtBuildYear.value,
      yachtType,
      yachtProgram,
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
      salaryMin: salaryMin.value,
      salaryMax: salaryMax.value,
      salaryCurrency: value.salaryCurrency,
      salaryPeriod: value.salaryPeriod,
      status: value.status,
      version,
    },
  };
}

export async function verifyJobPostingAuthority(
  client: SupabaseClient,
  userId: string,
): Promise<AuthorityResult> {
  const workspace = await loadJobPostingWorkspaceAuthority(client, userId);
  if (!workspace.ok) return workspace;

  if (
    !workspace.capabilities.canPostJobs ||
    workspace.capabilities.postingStatus !== "enabled"
  ) {
    return {
      ok: false,
      error:
        workspace.capabilities.postingStatus === "suspended"
          ? "Job posting is paused for this account."
          : "This account is not eligible to publish job posts.",
      status: 403,
    };
  }

  return { ok: true };
}

export async function verifyJobManagementAuthority(
  client: SupabaseClient,
  userId: string,
  jobPostId: string,
): Promise<JobManagementAuthorityResult> {
  const response = await client.rpc("bluedeck_can_manage_job", {
    p_actor_user_id: userId,
    p_job_post_id: jobPostId,
  });

  if (response.error) {
    logJobPostError("job_management_authority_failed", response.error, {
      actorUserId: userId,
      jobPostId,
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
      error: "Only the account that created this job post may manage it.",
      status: 403,
    };
  }

  return { ok: true };
}

export async function loadJobPostingWorkspaceAuthority(
  client: SupabaseClient,
  userId: string,
): Promise<JobPostingWorkspaceAuthority> {
  const entitlementResult = await loadOrEnsureMarketplaceEntitlement(
    client,
    userId,
  );

  if (!entitlementResult.ok) {
    logJobPostError("marketplace_entitlement_lookup_failed", entitlementResult.error, {
      actorUserId: userId,
    });
    return {
      ok: false,
      error: "Your marketplace access could not be verified.",
      status: 500,
    };
  }

  const entitlement = entitlementResult.entitlement;
  if (!entitlement) {
    return {
      ok: false,
      error: "Your marketplace access could not be verified.",
      status: 500,
    };
  }

  const publisherAuthority = await client.rpc("bluedeck_can_publish_jobs", {
    p_actor_user_id: userId,
  });
  if (publisherAuthority.error) {
    logJobPostError(
      "job_publisher_authority_lookup_failed",
      publisherAuthority.error,
      { actorUserId: userId },
    );
    return {
      ok: false,
      error: "Your job publishing access could not be checked.",
      status: 503,
    };
  }

  return {
    ok: true,
    capabilities: workspaceCapabilities(
      entitlement,
      publisherAuthority.data === true,
    ),
  };
}

function workspaceCapabilities(
  entitlement: MarketplaceEntitlement,
  hasPublisherAuthority: boolean,
): JobPostingWorkspaceCapabilities {
  const roleCanPost = entitlement.canPostJobs;
  return {
    role: entitlement.role,
    canPostJobs: roleCanPost && hasPublisherAuthority,
    canApplyJobs: entitlement.canApplyJobs,
    canUseCrewWorkspace: entitlement.canUseCrewWorkspace,
    requiresAdminApproval: false,
    postingStatus: entitlement.postingStatus,
    planCode: entitlement.planCode,
  };
}

export async function currentPublicJobPostIds(
  client: SupabaseClient,
  rows: unknown[],
): Promise<CurrentPublicAuthorityResult> {
  const authorityRows: Array<{
    jobPostId: string;
    createdBy: string;
  }> = [];

  for (const value of rows) {
    if (!isRecord(value)) {
      return { ok: false, error: "Invalid job post authority record." };
    }
    const jobPostId = cleanText(value.id);
    const createdBy = cleanText(value.created_by);
    if (!isUuid(jobPostId) || !isUuid(createdBy)) {
      return { ok: false, error: "Invalid job post authority record." };
    }
    authorityRows.push({ jobPostId, createdBy });
  }

  if (authorityRows.length === 0) {
    return { ok: true, jobPostIds: new Set() };
  }

  const response = await client.rpc("bluedeck_current_public_job_post_ids", {
    p_job_post_ids: authorityRows.map((row) => row.jobPostId),
  });
  if (response.error || !Array.isArray(response.data)) {
    logJobPostError(
      "current_public_marketplace_authority_failed",
      response.error,
    );
    return {
      ok: false,
      error: "Current employer authority could not be verified.",
    };
  }

  const requestedIds = new Set(authorityRows.map((row) => row.jobPostId));
  const jobPostIds = new Set<string>();
  for (const value of response.data) {
    const jobPostId = isRecord(value) ? cleanText(value.job_post_id) : "";
    if (!isUuid(jobPostId) || !requestedIds.has(jobPostId)) {
      return { ok: false, error: "Invalid job post authority response." };
    }
    jobPostIds.add(jobPostId);
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
    requiredSkills: base.requiredSkills,
    requiredCharacteristics: base.requiredCharacteristics,
    requiredCertificates: base.requiredCertificates,
    requiredVisas: base.requiredVisas,
    yachtBrand: base.yachtBrand,
    yachtFlagCountryCode: base.yachtFlagCountryCode,
    yachtBuildYear: base.yachtBuildYear,
    yachtType: base.yachtType,
    yachtProgram: base.yachtProgram,
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
    publishedAt: base.publishedAt,
  };
}

export function publicJobCardFromRow(value: unknown): PublicJobCard | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id);
  const position = cleanText(value.position);
  const yachtType = databaseJobYachtType(value.yacht_type);
  const yachtProgram = databaseJobYachtProgram(value.yacht_program);
  const yachtLength = databaseYachtLength(value.yacht_length);
  const yachtLengthUnit = databaseJobYachtLengthUnit(value.yacht_length_unit);
  const startDate = optionalDatabaseDate(value.start_date);
  const publishedAt = timestamp(value.published_at);
  const salaryMin = databaseMoney(value.salary_min);
  const salaryMax = databaseMoney(value.salary_max);

  if (
    !isUuid(id) ||
    !position ||
    !isJobEmploymentType(value.employment_type) ||
    !isJobCandidateType(value.candidate_type) ||
    yachtType === undefined ||
    yachtProgram === undefined ||
    yachtLength === undefined ||
    yachtLengthUnit === undefined ||
    (yachtLength === null) !== (yachtLengthUnit === null) ||
    !cleanText(value.location) ||
    startDate === undefined ||
    !publishedAt ||
    typeof value.salary_visible !== "boolean" ||
    salaryMin === undefined ||
    salaryMax === undefined ||
    !isJobSalaryCurrency(value.salary_currency) ||
    !isJobSalaryPeriod(value.salary_period)
  ) {
    return null;
  }

  return {
    id,
    position,
    employmentType: value.employment_type,
    candidateType: value.candidate_type,
    yachtType,
    yachtProgram,
    yachtLength,
    yachtLengthUnit,
    location: cleanText(value.location),
    startDate,
    publishedAt,
    salary: value.salary_visible
      ? {
          min: salaryMin,
          max: salaryMax,
          currency: value.salary_currency,
          period: value.salary_period,
        }
      : null,
  };
}

export function employerJobPostFromRow(value: unknown): EmployerJobPost | null {
  const base = jobPostBaseFromRow(value);
  if (!base || !isRecord(value)) return null;

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
    title: base.title,
    position: base.position,
    department: base.department,
    employmentType: base.employmentType,
    candidateType: base.candidateType,
    smokerPolicy: base.smokerPolicy,
    visibleTattooPolicy: base.visibleTattooPolicy,
    requiredLanguages: base.requiredLanguages,
    requiredSkills: base.requiredSkills,
    requiredCharacteristics: base.requiredCharacteristics,
    requiredCertificates: base.requiredCertificates,
    requiredVisas: base.requiredVisas,
    yachtBrand: base.yachtBrand,
    yachtFlagCountryCode: base.yachtFlagCountryCode,
    yachtBuildYear: base.yachtBuildYear,
    yachtType: base.yachtType,
    yachtProgram: base.yachtProgram,
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

export function jobPostMutationColumns(
  mutation: JobPostMutation,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    title: mutation.title,
    position: mutation.position,
    department: mutation.department,
    employment_type: mutation.employmentType,
    candidate_type: mutation.candidateType,
    smoker_policy: mutation.smokerPolicy,
    visible_tattoo_policy: mutation.visibleTattooPolicy,
    required_languages: mutation.requiredLanguages,
    required_skills: mutation.requiredSkills,
    required_characteristics: mutation.requiredCharacteristics,
    required_certificates: mutation.requiredCertificates,
    required_visas: mutation.requiredVisas,
    yacht_brand: mutation.yachtBrand,
    yacht_flag_country_code: mutation.yachtFlagCountryCode,
    yacht_build_year: mutation.yachtBuildYear,
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
    salary_visible:
      mutation.salaryMin !== null || mutation.salaryMax !== null,
    salary_min: mutation.salaryMin,
    salary_max: mutation.salaryMax,
    salary_currency: mutation.salaryCurrency,
    salary_period: mutation.salaryPeriod,
    status: mutation.status,
  };
  if (mutation.yachtProgram !== undefined) {
    columns.yacht_program = mutation.yachtProgram;
  }
  return columns;
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
  const yachtBrand = databaseOptionalText(value.yacht_brand, 80);
  const yachtFlagCountryCode = databaseYachtFlagCountryCode(
    value.yacht_flag_country_code,
  );
  const yachtBuildYear = databaseYachtBuildYear(value.yacht_build_year);
  const yachtType = databaseJobYachtType(value.yacht_type);
  const yachtProgram = databaseJobYachtProgram(value.yacht_program);
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
  const requiredSkills = databaseJobOptionList(
    value.required_skills,
    maximumJobSkillSelections,
    isJobSkill,
  );
  const requiredCharacteristics = databaseJobOptionList(
    value.required_characteristics,
    maximumJobCharacteristicSelections,
    isJobCharacteristic,
  );
  const requiredCertificates = databaseJobOptionList(
    value.required_certificates,
    maximumJobCertificateSelections,
    isJobCertificate,
  );
  const requiredVisas = databaseJobOptionList(
    value.required_visas,
    maximumJobVisaSelections,
    isJobVisa,
  );
  const salaryMin = databaseMoney(value.salary_min);
  const salaryMax = databaseMoney(value.salary_max);
  if (
    !isUuid(id) ||
    !isSupportedJobListingNumber(listingNumber) ||
    !title ||
    !position ||
    !department ||
    yachtBrand === undefined ||
    yachtFlagCountryCode === undefined ||
    yachtBuildYear === undefined ||
    yachtType === undefined ||
    yachtProgram === undefined ||
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
    !requiredSkills ||
    !requiredCharacteristics ||
    !requiredCertificates ||
    !requiredVisas ||
    typeof value.salary_visible !== "boolean" ||
    salaryMin === undefined ||
    salaryMax === undefined ||
    !isJobSalaryCurrency(value.salary_currency) ||
    !isJobSalaryPeriod(value.salary_period)
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
    requiredSkills,
    requiredCharacteristics,
    requiredCertificates,
    requiredVisas,
    yachtBrand,
    yachtFlagCountryCode,
    yachtBuildYear,
    yachtType,
    yachtProgram,
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

function optionalStrictText(
  value: unknown,
  maximumLength: number,
): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  return text.length <= maximumLength ? text : undefined;
}

function optionalYachtFlagCountryCode(
  value: unknown,
): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return countryOptionFromCode(value)?.code;
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

function jobOptionList<Option extends string>(
  value: unknown,
  maximumCount: number,
  isOption: (item: unknown) => item is Option,
): { ok: true; value: Option[] } | { ok: false } {
  // An omitted value remains compatible with a browser tab opened before the
  // new selectors were deployed.
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.length > maximumCount) {
    return { ok: false };
  }

  const result: Option[] = [];
  for (const item of value) {
    if (!isOption(item)) return { ok: false };
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

function databaseJobOptionList<Option extends string>(
  value: unknown,
  maximumCount: number,
  isOption: (item: unknown) => item is Option,
): Option[] | null {
  if (!Array.isArray(value) || value.length > maximumCount) return null;
  const result: Option[] = [];
  for (const item of value) {
    if (!isOption(item)) return null;
    if (!result.includes(item)) result.push(item);
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
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximumJobSalaryAmount
  ) {
    return { ok: false };
  }
  return { ok: true, value };
}

function optionalJobYachtType(value: unknown): JobYachtType | null | undefined {
  if (value === null) return null;
  return isJobYachtType(value) ? value : undefined;
}

function optionalJobYachtProgram(
  value: unknown,
): JobYachtProgram | null | undefined {
  if (value === null) return null;
  return isJobYachtProgram(value) ? value : undefined;
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
    rounded > 999
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

function optionalYachtBuildYear(
  value: unknown,
): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1800 ||
    value > 2100
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

function databaseOptionalText(
  value: unknown,
  maximumLength: number,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : undefined;
}

function databaseYachtFlagCountryCode(
  value: unknown,
): string | null | undefined {
  if (value === null) return null;
  return countryOptionFromCode(value)?.code;
}

function databaseJobYachtType(
  value: unknown,
): JobYachtType | null | undefined {
  if (value === null) return null;
  return isJobYachtType(value) ? value : undefined;
}

function databaseJobYachtProgram(
  value: unknown,
): JobYachtProgram | null | undefined {
  if (value === null) return null;
  return isJobYachtProgram(value) ? value : undefined;
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
  return Number.isFinite(length) && length > 0 && length <= 999
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

function databaseYachtBuildYear(value: unknown): number | null | undefined {
  if (value === null) return null;
  const year =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(year) && year >= 1800 && year <= 2100
    ? year
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
