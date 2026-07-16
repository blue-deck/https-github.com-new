import {
  JOBS_DEFAULT_PAGE_SIZE,
  JOBS_MAX_PAGE_SIZE,
  JOB_DEPARTMENTS,
  JOB_POSITIONS,
  isJobEmploymentType,
  isJobSort,
} from "./constants";
import type {
  JobsFilters,
  JobsSearchParams,
} from "./types";

const JOB_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SearchParamSource = JobsSearchParams | URLSearchParams;

function firstValue(
  source: SearchParamSource,
  key: string,
): string {
  if (source instanceof URLSearchParams) {
    return source.get(key) || "";
  }

  const value = source[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function cleanText(value: string, maximumLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function positiveInteger(
  value: string,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function parseJobsFilters(source: SearchParamSource): JobsFilters {
  const rawDepartment = cleanText(firstValue(source, "department"), 40);
  const department =
    JOB_DEPARTMENTS.find(
      (item) => item.toLowerCase() === rawDepartment.toLowerCase(),
    ) || "";

  const rawPosition = cleanText(firstValue(source, "position"), 100);
  const position =
    JOB_POSITIONS.find(
      (item) => item.title.toLowerCase() === rawPosition.toLowerCase(),
    )?.title || "";

  const rawEmploymentType = cleanText(
    firstValue(source, "employment"),
    30,
  ).toLowerCase();
  const employmentType = isJobEmploymentType(rawEmploymentType)
    ? rawEmploymentType
    : "";

  const rawSort = cleanText(firstValue(source, "sort"), 30).toLowerCase();

  return {
    query: cleanText(firstValue(source, "q"), 100),
    department,
    position,
    employmentType,
    location: cleanText(firstValue(source, "location"), 100),
    sort: isJobSort(rawSort) ? rawSort : "newest",
    page: positiveInteger(firstValue(source, "page"), 1, 10_000),
    pageSize: positiveInteger(
      firstValue(source, "limit"),
      JOBS_DEFAULT_PAGE_SIZE,
      JOBS_MAX_PAGE_SIZE,
    ),
  };
}

export function isValidJobSlug(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 160 &&
    JOB_SLUG_PATTERN.test(value)
  );
}

export function getActiveJobFilterCount(filters: JobsFilters): number {
  return [
    filters.query,
    filters.department,
    filters.position,
    filters.employmentType,
    filters.location,
  ].filter(Boolean).length;
}
