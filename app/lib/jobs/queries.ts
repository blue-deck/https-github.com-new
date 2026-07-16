import { cache } from "react";
import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../supabaseConfig";
import {
  isJobEmploymentType,
  isJobSalaryPeriod,
} from "./constants";
import type {
  JobEmployerSummary,
  JobSalary,
  JobsFilters,
  PublicJobDetail,
  PublicJobListItem,
  PublicJobResult,
  PublicJobsResult,
} from "./types";
import {
  yachtDepartments,
  type YachtDepartmentId,
} from "../yachtOperations";

const PUBLIC_JOB_SELECT = [
  "id",
  "slug",
  "title",
  "position",
  "department",
  "employment_type",
  "employer_id",
  "location",
  "country_code",
  "yacht_name",
  "yacht_type",
  "yacht_length_metres",
  "yacht_program",
  "rotation",
  "start_date",
  "end_date",
  "summary",
  "description",
  "responsibilities",
  "requirements",
  "benefits",
  "certifications",
  "visas",
  "languages",
  "minimum_experience_years",
  "application_instructions",
  "salary_currency",
  "salary_minimum",
  "salary_maximum",
  "salary_period",
  "salary_visible",
  "featured",
  "openings_count",
  "status",
  "application_deadline",
  "published_at",
  "expires_at",
].join(",");

const PUBLIC_EMPLOYER_SELECT = [
  "id",
  "display_name",
  "company_name",
  "verification_status",
].join(",");

type DatabaseRow = Record<string, unknown>;

export async function getPublicJobs(
  filters: JobsFilters,
): Promise<PublicJobsResult> {
  const client = createPublicJobsClient();
  if (!client) return unavailableJobsResult(filters);

  const now = new Date().toISOString();
  const searchPattern = toPostgrestIlikePattern(filters.query);
  const locationPattern = toPostgrestIlikePattern(filters.location);
  let countQuery = client
    .from("job_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .lte("published_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`application_deadline.is.null,application_deadline.gte.${now}`);

  if (filters.department) {
    countQuery = countQuery.eq("department", filters.department);
  }
  if (filters.position) {
    countQuery = countQuery.eq("position", filters.position);
  }
  if (filters.employmentType) {
    countQuery = countQuery.eq("employment_type", filters.employmentType);
  }
  if (searchPattern) {
    countQuery = countQuery.or(publicJobSearchFilter(searchPattern));
  }
  if (locationPattern) {
    countQuery = countQuery.or(
      `location.ilike.${locationPattern},country_code.ilike.${locationPattern}`,
    );
  }

  const countResult = await countQuery;
  if (countResult.error) {
    reportJobsQueryError("count", countResult.error);
    return unavailableJobsResult(filters);
  }

  const total = countResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;
  let query = client
    .from("job_posts")
    .select(PUBLIC_JOB_SELECT)
    .eq("status", "published")
    .lte("published_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`application_deadline.is.null,application_deadline.gte.${now}`);

  if (filters.department) {
    query = query.eq("department", filters.department);
  }
  if (filters.position) {
    query = query.eq("position", filters.position);
  }
  if (filters.employmentType) {
    query = query.eq("employment_type", filters.employmentType);
  }
  if (searchPattern) {
    query = query.or(publicJobSearchFilter(searchPattern));
  }
  if (locationPattern) {
    query = query.or(
      `location.ilike.${locationPattern},country_code.ilike.${locationPattern}`,
    );
  }

  query =
    filters.sort === "starting-soon"
      ? query
          .order("start_date", { ascending: true, nullsFirst: false })
          .order("featured", { ascending: false })
          .order("published_at", { ascending: false })
      : query
          .order("featured", { ascending: false })
          .order("published_at", { ascending: false });

  const { data, error } = await query.range(
    offset,
    offset + filters.pageSize - 1,
  );
  if (error) {
    reportJobsQueryError("list", error);
    return unavailableJobsResult(filters);
  }

  const rows = asRows(data);
  const employers = await loadVerifiedEmployers(client, rows);
  if (!employers) return unavailableJobsResult(filters);

  const jobs = rows
    .map((row) => mapJobListItem(row, employers))
    .filter((job): job is PublicJobListItem => job !== null);

  return {
    jobs,
    total,
    page,
    pageSize: filters.pageSize,
    totalPages,
    state: "ready",
  };
}

async function queryPublicJobBySlug(
  slug: string,
): Promise<PublicJobResult> {
  const client = createPublicJobsClient();
  if (!client) return { job: null, state: "unavailable" };

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("job_posts")
    .select(PUBLIC_JOB_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`application_deadline.is.null,application_deadline.gte.${now}`)
    .maybeSingle();

  if (error) {
    reportJobsQueryError("detail", error);
    return { job: null, state: "unavailable" };
  }
  if (!data) return { job: null, state: "ready" };

  const row = data as unknown as DatabaseRow;
  const employers = await loadVerifiedEmployers(client, [row]);
  if (!employers) return { job: null, state: "unavailable" };

  return {
    job: mapJobDetail(row, employers),
    state: "ready",
  };
}

export const getPublicJobBySlug = cache(queryPublicJobBySlug);

export async function getPublicJobSitemapEntries(): Promise<
  Array<{ slug: string; updatedAt: string | null }>
> {
  const client = createPublicJobsClient();
  if (!client) return [];

  const now = new Date().toISOString();
  const entries: Array<{ slug: string; updatedAt: string | null }> = [];
  const pageSize = 1_000;

  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await client
      .from("job_posts")
      .select("slug,updated_at")
      .eq("status", "published")
      .lte("published_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or(`application_deadline.is.null,application_deadline.gte.${now}`)
      .order("published_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      reportJobsQueryError("sitemap", error);
      return entries;
    }

    const rows = asRows(data);
    for (const row of rows) {
      const slug = asString(row.slug);
      if (!slug) continue;
      entries.push({
        slug,
        updatedAt: asDateString(row.updated_at),
      });
    }

    if (rows.length < pageSize) break;
  }

  return entries;
}

function createPublicJobsClient(): SupabaseClient | null {
  const anonymousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonymousKey) return null;

  return createClient(
    resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonymousKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function loadVerifiedEmployers(
  client: SupabaseClient,
  rows: DatabaseRow[],
): Promise<Map<string, JobEmployerSummary> | null> {
  const employerIds = [
    ...new Set(
      rows
        .map((row) => asString(row.employer_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (employerIds.length === 0) return new Map();

  const { data, error } = await client
    .from("employer_profiles")
    .select(PUBLIC_EMPLOYER_SELECT)
    .in("id", employerIds)
    .eq("verification_status", "verified");

  if (error) {
    reportJobsQueryError("employers", error);
    return null;
  }

  return new Map(
    asRows(data)
      .map((row) => {
        const id = asString(row.id);
        if (!id) return null;
        return [
          id,
          {
            name:
              nullableString(row.display_name) ||
              nullableString(row.company_name),
            verified: row.verification_status === "verified",
          } satisfies JobEmployerSummary,
        ] as const;
      })
      .filter(
        (
          value,
        ): value is readonly [string, JobEmployerSummary] => value !== null,
      ),
  );
}

function mapJobListItem(
  row: DatabaseRow,
  employers: Map<string, JobEmployerSummary>,
): PublicJobListItem | null {
  const id = asString(row.id);
  const slug = asString(row.slug);
  const title = asString(row.title);
  const position = asString(row.position);
  const employerId = asString(row.employer_id);
  const employer = employerId ? employers.get(employerId) : undefined;

  if (!id || !slug || !title || !position || !employer) return null;

  const employmentValue = asString(row.employment_type);
  const minimum = asNullableNumber(row.salary_minimum);
  const maximum = asNullableNumber(row.salary_maximum);
  const salaryPeriod = asString(row.salary_period);
  const validSalaryPeriod =
    salaryPeriod && isJobSalaryPeriod(salaryPeriod)
      ? salaryPeriod
      : null;
  const salaryCurrency = asString(row.salary_currency)?.toUpperCase();
  const salaryVisible = row.salary_visible === true;
  const salary: JobSalary | null =
    salaryVisible &&
    Boolean(salaryCurrency?.match(/^[A-Z]{3}$/)) &&
    validSalaryPeriod &&
    (minimum !== null || maximum !== null)
      ? {
          currency: salaryCurrency!,
          minimum,
          maximum,
          period: validSalaryPeriod,
        }
      : null;

  return {
    id,
    slug,
    title,
    position,
    department: asDepartment(row.department),
    employmentType:
      employmentValue && isJobEmploymentType(employmentValue)
        ? employmentValue
        : null,
    employer,
    location: nullableString(row.location),
    countryCode: nullableString(row.country_code),
    yachtName: nullableString(row.yacht_name),
    yachtType: nullableString(row.yacht_type),
    yachtLengthMetres: asNullableNumber(row.yacht_length_metres),
    yachtProgram: nullableString(row.yacht_program),
    rotation: nullableString(row.rotation),
    startDate: asDateString(row.start_date),
    endDate: asDateString(row.end_date),
    applicationDeadline: asDateString(row.application_deadline),
    openingsCount: Math.max(1, asNullableInteger(row.openings_count) || 1),
    summary: nullableString(row.summary),
    salary,
    featured: row.featured === true,
    publishedAt: asDateString(row.published_at),
    expiresAt: asDateString(row.expires_at),
  };
}

function mapJobDetail(
  row: DatabaseRow,
  employers: Map<string, JobEmployerSummary>,
): PublicJobDetail | null {
  const listItem = mapJobListItem(row, employers);
  const description = asString(row.description);
  if (!listItem || !description) return null;

  return {
    ...listItem,
    description,
    responsibilities: asStringArray(row.responsibilities),
    requirements: asStringArray(row.requirements),
    benefits: asStringArray(row.benefits),
    certifications: asStringArray(row.certifications),
    visas: asStringArray(row.visas),
    languages: asStringArray(row.languages),
    minimumExperienceYears: asNullableNumber(
      row.minimum_experience_years,
    ),
    applicationInstructions: nullableString(row.application_instructions),
  };
}

function publicJobSearchFilter(pattern: string) {
  return [
    "title",
    "position",
    "department",
    "summary",
    "location",
    "country_code",
    "yacht_name",
    "yacht_type",
    "yacht_program",
  ]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

function toPostgrestIlikePattern(value: string) {
  const clean = value
    .replace(/[,()."'\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return clean ? `%${clean}%` : "";
}

function unavailableJobsResult(filters: JobsFilters): PublicJobsResult {
  return {
    jobs: [],
    total: 0,
    page: 1,
    pageSize: filters.pageSize,
    totalPages: 1,
    state: "unavailable",
  };
}

function asRows(value: unknown): DatabaseRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is DatabaseRow =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean : null;
}

function nullableString(value: unknown): string | null {
  return asString(value);
}

function asDateString(value: unknown): string | null {
  const clean = asString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableInteger(value: unknown): number | null {
  const number = asNullableNumber(value);
  return number === null ? null : Math.round(number);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function asDepartment(value: unknown): YachtDepartmentId | null {
  const department = asString(value);
  if (!department) return null;
  return (
    yachtDepartments.find(
      (item) => item.toLowerCase() === department.toLowerCase(),
    ) || null
  );
}

function reportJobsQueryError(
  operation: string,
  error: PostgrestError,
): void {
  const schemaUnavailable =
    ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(
      error.code,
    ) ||
    /schema cache|does not exist|could not find/i.test(error.message);

  if (!schemaUnavailable) {
    console.error(`[jobs] Public ${operation} query failed`, {
      code: error.code,
    });
  }
}
