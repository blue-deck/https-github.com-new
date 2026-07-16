import {
  yachtCrewPositions,
  yachtDepartments,
  type YachtDepartmentId,
} from "../yachtOperations";
import type {
  JobEmploymentType,
  JobSalaryPeriod,
  JobSort,
} from "./types";

export const JOB_DEPARTMENTS = yachtDepartments;

export const JOB_POSITIONS = yachtCrewPositions.map((position) => ({
  title: position.title,
  department: position.department,
}));

export const JOB_EMPLOYMENT_OPTIONS: ReadonlyArray<{
  value: JobEmploymentType;
  label: string;
}> = [
  { value: "permanent", label: "Permanent" },
  { value: "seasonal", label: "Seasonal" },
  { value: "rotational", label: "Rotational" },
  { value: "temporary", label: "Temporary" },
  { value: "delivery", label: "Delivery" },
  { value: "daywork", label: "Daywork" },
  { value: "freelance", label: "Freelance" },
];

export const JOB_SORT_OPTIONS: ReadonlyArray<{
  value: JobSort;
  label: string;
}> = [
  { value: "newest", label: "Newest first" },
  { value: "starting-soon", label: "Starting soon" },
];

export const JOB_SALARY_PERIODS = [
  "hour",
  "day",
  "week",
  "month",
  "year",
  "contract",
] as const satisfies readonly JobSalaryPeriod[];

export const JOBS_DEFAULT_PAGE_SIZE = 18;
export const JOBS_MAX_PAGE_SIZE = 50;

export function isJobDepartment(
  value: string,
): value is YachtDepartmentId {
  return JOB_DEPARTMENTS.some(
    (department) => department.toLowerCase() === value.toLowerCase(),
  );
}

export function isJobEmploymentType(
  value: string,
): value is JobEmploymentType {
  return JOB_EMPLOYMENT_OPTIONS.some((option) => option.value === value);
}

export function isJobSalaryPeriod(
  value: string,
): value is JobSalaryPeriod {
  return JOB_SALARY_PERIODS.some((period) => period === value);
}

export function isJobSort(value: string): value is JobSort {
  return JOB_SORT_OPTIONS.some((option) => option.value === value);
}
