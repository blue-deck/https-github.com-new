import { nationalityOptions } from "./countries";
import {
  jobCandidateTypes,
  jobEmploymentTypes,
  jobMinimumYachtExperiences,
  jobRequiredLanguages,
  jobSalaryCurrencies,
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
  candidateTypes: jobCandidateTypes,
  yachtTypes: jobYachtTypes,
  minimumYachtExperiences: jobMinimumYachtExperiences,
  requiredLanguages: jobRequiredLanguages,
  visas: jobVisaOptions,
  salaryCurrencies: jobSalaryCurrencies,
  salaryPeriods: jobSalaryPeriods,
  yachtFlagCountryCodes: nationalityOptions.map((country) => country.code),
} satisfies PublicJobSearchTaxonomy;
