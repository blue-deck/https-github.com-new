import { nationalityOptions } from "./countries";
import {
  jobCandidateTypes,
  jobEmploymentTypes,
  jobMinimumYachtExperiences,
  jobRequiredLanguages,
  jobSalaryCurrencyOptions,
  jobSalaryPeriods,
  jobVisaOptions,
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
  minimumYachtExperiences: jobMinimumYachtExperiences,
  requiredLanguages: jobRequiredLanguages,
  visas: jobVisaOptions,
  salaryCurrencies: jobSalaryCurrencyOptions,
  salaryPeriods: jobSalaryPeriods,
  yachtFlagCountryCodes: nationalityOptions.map((country) => country.code),
} satisfies PublicJobSearchTaxonomy;
