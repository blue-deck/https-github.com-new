import { nationalityOptions } from "./countries";
import {
  jobCandidateTypes,
  jobCertificateOptions,
  jobCharacteristicOptions,
  jobEmploymentTypes,
  jobMinimumYachtExperiences,
  jobRequiredLanguages,
  jobSalaryCurrencies,
  jobSalaryPeriods,
  jobSmokerPolicies,
  jobVisaOptions,
  jobVisibleTattooPolicies,
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
  characteristics: jobCharacteristicOptions,
  certificates: jobCertificateOptions,
  visas: jobVisaOptions,
  smokerPolicies: jobSmokerPolicies,
  visibleTattooPolicies: jobVisibleTattooPolicies,
  salaryCurrencies: jobSalaryCurrencies,
  salaryPeriods: jobSalaryPeriods,
  yachtFlagCountryCodes: nationalityOptions.map((country) => country.code),
} satisfies PublicJobSearchTaxonomy;
