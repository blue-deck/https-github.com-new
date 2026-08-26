import { nationalityOptions } from "./countries";
import {
  jobCandidateTypes,
  jobEmploymentTypes,
  jobSalaryCurrencyOptions,
  jobSalaryPeriods,
  jobYachtPrograms,
  jobYachtTypes,
} from "./jobPosts";
import type { PublicJobSearchTaxonomy } from "./publicJobSearch";
import { yachtDepartments, yachtPositionTitles } from "./yachtOperations";

export const publicJobSearchTaxonomy = {
  positions: Array.from(new Set(yachtPositionTitles)),
  departments: yachtDepartments,
  employmentTypes: jobEmploymentTypes,
  candidateTypes: jobCandidateTypes.filter((value) => value !== "any"),
  yachtTypes: jobYachtTypes,
  yachtPrograms: jobYachtPrograms,
  salaryCurrencies: jobSalaryCurrencyOptions,
  salaryPeriods: jobSalaryPeriods,
  yachtFlagCountryCodes: nationalityOptions.map((country) => country.code),
} satisfies PublicJobSearchTaxonomy;
