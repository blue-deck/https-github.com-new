import type {
  JobCandidateType,
  JobEmploymentType,
  JobSalaryCurrency,
  JobSalaryPeriod,
  JobYachtProgram,
  JobYachtType,
  PublicJobPost,
} from "./jobPosts";
import { maximumJobSalaryAmount } from "./jobSalaryAmount.js";

export const publicJobSearchSorts = [
  "newest",
  "start_soonest",
  "salary_highest",
  "salary_lowest",
  "yacht_length_desc",
  "yacht_length_asc",
] as const;

export const defaultPublicJobSearchLimit = 20;
export const maximumPublicJobSearchCursorLength = 2_048;
export const publicJobYachtLengthSlider = {
  minimumMetres: 0,
  maximumMetres: 200,
  stepMetres: 5,
} as const;
export const publicJobCrewSizeSlider = {
  minimumCrewMembers: 0,
  minimumActiveCrewMembers: 1,
  maximumCrewMembers: 50,
  stepCrewMembers: 1,
} as const;

export type PublicJobSearchSort = (typeof publicJobSearchSorts)[number];

export type PublicJobSearchTaxonomy = {
  positions: readonly string[];
  departments: readonly string[];
  employmentTypes: readonly JobEmploymentType[];
  candidateTypes: readonly JobCandidateType[];
  yachtTypes: readonly JobYachtType[];
  yachtPrograms: readonly JobYachtProgram[];
  salaryCurrencies: readonly JobSalaryCurrency[];
  salaryPeriods: readonly JobSalaryPeriod[];
  yachtFlagCountryCodes: readonly string[];
};

export type PublicJobSearchFilters = {
  query: string;
  positions: string[];
  departments: string[];
  location: string;
  employmentTypes: JobEmploymentType[];
  candidateTypes: JobCandidateType[];
  yachtTypes: JobYachtType[];
  yachtProgram: JobYachtProgram | null;
  yachtFlagCountryCodes: string[];
  yachtLengthMinMetres: number | null;
  yachtLengthMaxMetres: number | null;
  crewMemberCountMin: number | null;
  crewMemberCountMax: number | null;
  salaryCurrency: JobSalaryCurrency | null;
  salaryPeriod: JobSalaryPeriod | null;
  salaryMin: number | null;
  salaryMax: number | null;
  sort: PublicJobSearchSort;
  limit: number;
};

export type PublicJobSearchAnchor = {
  primary: string | number | null;
  publishedAt: string;
  id: string;
};

export type PublicJobSearchCursorPayload = {
  snapshotAt: string;
  resultFingerprint: string;
  total: number;
  anchor: PublicJobSearchAnchor;
};

export type PublicJobSearchParseResult =
  | {
      ok: true;
      filters: PublicJobSearchFilters;
      cursor: string | null;
    }
  | { ok: false; error: string };

const queryKeys = new Set([
  "q",
  "position",
  "department",
  "location",
  "employmentType",
  "candidateType",
  "yachtType",
  "yachtProgram",
  "yachtFlag",
  "lengthMin",
  "lengthMax",
  "crewMin",
  "crewMax",
  "salaryCurrency",
  "salaryPeriod",
  "salaryMin",
  "salaryMax",
  "sort",
  "cursor",
]);

const multiValueLimits: Record<string, number> = {
  position: 12,
  department: 11,
  employmentType: 5,
  candidateType: 3,
  yachtType: 11,
  yachtFlag: 12,
};

const scalarKeys = [
  "q",
  "location",
  "yachtProgram",
  "lengthMin",
  "lengthMax",
  "crewMin",
  "crewMax",
  "salaryCurrency",
  "salaryPeriod",
  "salaryMin",
  "salaryMax",
  "sort",
  "cursor",
] as const;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encryptedCursorPattern = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{24,2000}$/;

export function createDefaultPublicJobSearchFilters(): PublicJobSearchFilters {
  return {
    query: "",
    positions: [],
    departments: [],
    location: "",
    employmentTypes: [],
    candidateTypes: [],
    yachtTypes: [],
    yachtProgram: null,
    yachtFlagCountryCodes: [],
    yachtLengthMinMetres: null,
    yachtLengthMaxMetres: null,
    crewMemberCountMin: null,
    crewMemberCountMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    salaryMin: null,
    salaryMax: null,
    sort: "newest",
    limit: defaultPublicJobSearchLimit,
  };
}

export function parsePublicJobSearchParams(
  searchParams: URLSearchParams,
  taxonomy: PublicJobSearchTaxonomy,
): PublicJobSearchParseResult {
  for (const key of searchParams.keys()) {
    if (!queryKeys.has(key)) {
      return { ok: false, error: "The job search contains unsupported filters." };
    }
  }

  for (const key of scalarKeys) {
    if (searchParams.getAll(key).length > 1) {
      return { ok: false, error: `The ${key} filter may only be provided once.` };
    }
  }

  const query = boundedText(searchParams.get("q"), 120);
  const location = boundedText(searchParams.get("location"), 120);
  if (query === null || location === null) {
    return { ok: false, error: "One or more text filters are invalid." };
  }

  const positions = enumList(
    searchParams,
    "position",
    taxonomy.positions,
  );
  const departments = enumList(
    searchParams,
    "department",
    taxonomy.departments,
  );
  const employmentTypes = enumList(
    searchParams,
    "employmentType",
    taxonomy.employmentTypes,
  );
  const candidateTypes = enumList(
    searchParams,
    "candidateType",
    taxonomy.candidateTypes,
  );
  const yachtTypes = enumList(
    searchParams,
    "yachtType",
    taxonomy.yachtTypes,
  );
  const yachtFlagCountryCodes = enumList(
    searchParams,
    "yachtFlag",
    taxonomy.yachtFlagCountryCodes,
    (value) => value.toUpperCase(),
  );
  const enumLists = [
    positions,
    departments,
    employmentTypes,
    candidateTypes,
    yachtTypes,
    yachtFlagCountryCodes,
  ];
  const invalidEnumList = enumLists.find((result) => !result.ok);
  if (invalidEnumList && !invalidEnumList.ok) {
    return { ok: false, error: invalidEnumList.error };
  }

  const yachtLengthMinMetres = steppedIntegerFilter(
    searchParams.get("lengthMin"),
    publicJobYachtLengthSlider.minimumMetres,
    publicJobYachtLengthSlider.maximumMetres,
    publicJobYachtLengthSlider.stepMetres,
  );
  const yachtLengthMaxMetres = steppedIntegerFilter(
    searchParams.get("lengthMax"),
    publicJobYachtLengthSlider.minimumMetres,
    publicJobYachtLengthSlider.maximumMetres,
    publicJobYachtLengthSlider.stepMetres,
  );
  const crewMemberCountMin = integerFilter(
    searchParams.get("crewMin"),
    publicJobCrewSizeSlider.minimumActiveCrewMembers,
    publicJobCrewSizeSlider.maximumCrewMembers,
  );
  const crewMemberCountMax = integerFilter(
    searchParams.get("crewMax"),
    publicJobCrewSizeSlider.minimumCrewMembers,
    publicJobCrewSizeSlider.maximumCrewMembers,
  );
  const salaryMin = integerFilter(
    searchParams.get("salaryMin"),
    0,
    maximumJobSalaryAmount,
  );
  const salaryMax = integerFilter(
    searchParams.get("salaryMax"),
    0,
    maximumJobSalaryAmount,
  );

  const numericFilters = [
    yachtLengthMinMetres,
    yachtLengthMaxMetres,
    crewMemberCountMin,
    crewMemberCountMax,
    salaryMin,
    salaryMax,
  ];
  if (numericFilters.some((result) => !result.ok)) {
    return { ok: false, error: "One or more numeric filters are invalid." };
  }

  const salaryCurrency = optionalEnum(
    searchParams.get("salaryCurrency"),
    taxonomy.salaryCurrencies,
  );
  const salaryPeriod = optionalEnum(
    searchParams.get("salaryPeriod"),
    taxonomy.salaryPeriods,
  );
  const yachtProgram = optionalEnum(
    searchParams.get("yachtProgram"),
    taxonomy.yachtPrograms,
  );
  const sort = optionalEnum(
    searchParams.get("sort"),
    publicJobSearchSorts,
  );
  if (
    salaryCurrency === undefined ||
    salaryPeriod === undefined ||
    yachtProgram === undefined ||
    sort === undefined
  ) {
    return { ok: false, error: "One or more selection filters are invalid." };
  }

  const cursorValue = searchParams.get("cursor");
  if (
    cursorValue !== null &&
    (cursorValue.length > maximumPublicJobSearchCursorLength ||
      !encryptedCursorPattern.test(cursorValue))
  ) {
    return { ok: false, error: "The job search cursor is invalid." };
  }

  const filters: PublicJobSearchFilters = {
    query,
    positions: successfulList(positions),
    departments: successfulList(departments),
    location,
    employmentTypes: successfulList(employmentTypes),
    candidateTypes: successfulList(candidateTypes),
    yachtTypes: successfulList(yachtTypes),
    yachtProgram,
    yachtFlagCountryCodes: successfulList(yachtFlagCountryCodes),
    yachtLengthMinMetres: numericValue(yachtLengthMinMetres),
    yachtLengthMaxMetres: numericValue(yachtLengthMaxMetres),
    crewMemberCountMin: numericValue(crewMemberCountMin),
    crewMemberCountMax: numericValue(crewMemberCountMax),
    salaryCurrency,
    salaryPeriod,
    salaryMin: numericValue(salaryMin),
    salaryMax: numericValue(salaryMax),
    sort: sort || "newest",
    limit: defaultPublicJobSearchLimit,
  };

  if (
    reversed(filters.yachtLengthMinMetres, filters.yachtLengthMaxMetres) ||
    reversed(filters.crewMemberCountMin, filters.crewMemberCountMax) ||
    reversed(filters.salaryMin, filters.salaryMax)
  ) {
    return { ok: false, error: "A minimum filter cannot exceed its maximum." };
  }

  const salaryRangeSelected =
    filters.salaryMin !== null || filters.salaryMax !== null;
  const salarySortSelected =
    filters.sort === "salary_highest" || filters.sort === "salary_lowest";
  if (
    (salaryRangeSelected || salarySortSelected) &&
    (!filters.salaryCurrency || !filters.salaryPeriod)
  ) {
    return {
      ok: false,
      error: "Select a salary currency and period before using salary ranges or sorting.",
    };
  }

  return { ok: true, filters, cursor: cursorValue || null };
}

export function publicJobSearchParams(
  filters: PublicJobSearchFilters,
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  setText(params, "q", filters.query);
  setList(params, "position", filters.positions);
  setList(params, "department", filters.departments);
  setText(params, "location", filters.location);
  setList(params, "employmentType", filters.employmentTypes);
  setList(params, "candidateType", filters.candidateTypes);
  setList(params, "yachtType", filters.yachtTypes);
  setText(params, "yachtProgram", filters.yachtProgram || "");
  setList(params, "yachtFlag", filters.yachtFlagCountryCodes);
  setNumber(params, "lengthMin", filters.yachtLengthMinMetres);
  setNumber(params, "lengthMax", filters.yachtLengthMaxMetres);
  setNumber(params, "crewMin", filters.crewMemberCountMin);
  setNumber(params, "crewMax", filters.crewMemberCountMax);
  setText(params, "salaryCurrency", filters.salaryCurrency || "");
  setText(params, "salaryPeriod", filters.salaryPeriod || "");
  setNumber(params, "salaryMin", filters.salaryMin);
  setNumber(params, "salaryMax", filters.salaryMax);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (cursor) params.set("cursor", cursor);
  return params;
}

export function canonicalPublicJobSearchFilters(
  filters: PublicJobSearchFilters,
) {
  return publicJobSearchParams({
    ...filters,
    positions: canonicalList(filters.positions),
    departments: canonicalList(filters.departments),
    employmentTypes: canonicalList(filters.employmentTypes),
    candidateTypes: canonicalList(filters.candidateTypes),
    yachtTypes: canonicalList(filters.yachtTypes),
    yachtFlagCountryCodes: canonicalList(filters.yachtFlagCountryCodes),
    limit: defaultPublicJobSearchLimit,
  }).toString();
}

export function hasPublicJobSearchFilters(filters: PublicJobSearchFilters) {
  const defaults = createDefaultPublicJobSearchFilters();
  return canonicalPublicJobSearchFilters(filters) !==
    canonicalPublicJobSearchFilters({ ...defaults, sort: filters.sort });
}

export function matchesPublicJobSearch(
  job: PublicJobPost,
  filters: PublicJobSearchFilters,
) {
  if (
    filters.query &&
    !keywordMatches(publicJobSearchDocument(job), filters.query)
  ) {
    return false;
  }
  if (!includesSelected(filters.positions, job.position)) return false;
  if (!includesSelected(filters.departments, job.department)) return false;
  if (
    filters.location &&
    !foldText(job.location).includes(foldText(filters.location))
  ) {
    return false;
  }
  if (!includesSelected(filters.employmentTypes, job.employmentType)) return false;
  if (!matchesCandidateType(filters.candidateTypes, job.candidateType)) {
    return false;
  }
  if (!includesSelected(filters.yachtTypes, job.yachtType)) return false;
  if (
    filters.yachtProgram !== null &&
    job.yachtProgram !== filters.yachtProgram
  ) {
    return false;
  }
  if (
    !includesSelected(filters.yachtFlagCountryCodes, job.yachtFlagCountryCode)
  ) {
    return false;
  }

  const yachtLengthMetres = publicJobYachtLengthMetres(
    job.yachtLength,
    job.yachtLengthUnit,
  );
  if (
    (filters.yachtLengthMinMetres !== null ||
      filters.yachtLengthMaxMetres !== null) &&
    (yachtLengthMetres === null ||
      (filters.yachtLengthMinMetres !== null &&
        yachtLengthMetres < filters.yachtLengthMinMetres) ||
      (filters.yachtLengthMaxMetres !== null &&
        yachtLengthMetres > filters.yachtLengthMaxMetres))
  ) {
    return false;
  }
  if (
    (filters.crewMemberCountMin !== null ||
      filters.crewMemberCountMax !== null) &&
    (job.crewMemberCount === null ||
      (filters.crewMemberCountMin !== null &&
        job.crewMemberCount < filters.crewMemberCountMin) ||
      (filters.crewMemberCountMax !== null &&
        job.crewMemberCount > filters.crewMemberCountMax))
  ) {
    return false;
  }
  const salaryFilterSelected =
    filters.salaryCurrency !== null ||
    filters.salaryPeriod !== null ||
    filters.salaryMin !== null ||
    filters.salaryMax !== null;
  if (salaryFilterSelected) {
    if (
      !job.salary ||
      (filters.salaryCurrency &&
        job.salary.currency !== filters.salaryCurrency) ||
      (filters.salaryPeriod && job.salary.period !== filters.salaryPeriod)
    ) {
      return false;
    }
    const jobMinimum = job.salary.min ?? job.salary.max;
    const jobMaximum = job.salary.max ?? job.salary.min;
    if (
      (filters.salaryMin !== null &&
        (jobMaximum === null || jobMaximum < filters.salaryMin)) ||
      (filters.salaryMax !== null &&
        (jobMinimum === null || jobMinimum > filters.salaryMax))
    ) {
      return false;
    }
  }

  return true;
}

export function comparePublicJobs(
  left: PublicJobPost,
  right: PublicJobPost,
  sort: PublicJobSearchSort,
) {
  return comparePublicJobSearchAnchors(
    publicJobSearchAnchor(left, sort),
    publicJobSearchAnchor(right, sort),
    sort,
  );
}

export function publicJobSearchAnchor(
  job: PublicJobPost,
  sort: PublicJobSearchSort,
): PublicJobSearchAnchor {
  let primary: string | number | null;
  if (sort === "newest") {
    primary = job.publishedAt;
  } else if (sort === "start_soonest") {
    primary = job.startDate;
  } else if (sort === "salary_highest") {
    primary = job.salary?.max ?? job.salary?.min ?? null;
  } else if (sort === "salary_lowest") {
    primary = job.salary?.min ?? job.salary?.max ?? null;
  } else {
    primary = publicJobYachtLengthMetres(job.yachtLength, job.yachtLengthUnit);
  }
  return { primary, publishedAt: job.publishedAt, id: job.id };
}

export function comparePublicJobSearchAnchors(
  left: PublicJobSearchAnchor,
  right: PublicJobSearchAnchor,
  sort: PublicJobSearchSort,
) {
  const descending =
    sort === "newest" ||
    sort === "salary_highest" ||
    sort === "yacht_length_desc";
  const primary = compareNullablePrimary(left.primary, right.primary, descending);
  if (primary !== 0) return primary;
  const published = right.publishedAt.localeCompare(left.publishedAt);
  return published || left.id.localeCompare(right.id);
}

export function publicJobSearchPageStartIndex(
  jobs: PublicJobPost[],
  sort: PublicJobSearchSort,
  anchor: PublicJobSearchAnchor | null,
) {
  if (!anchor) return 0;
  const index = jobs.findIndex(
    (job) =>
      comparePublicJobSearchAnchors(
        publicJobSearchAnchor(job, sort),
        anchor,
        sort,
      ) > 0,
  );
  return index < 0 ? jobs.length : index;
}

export function publicJobYachtLengthMetres(
  value: number | null,
  unit: "m" | "ft" | null,
) {
  if (
    value === null ||
    unit === null ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }
  const metres = unit === "ft" ? value * 0.3048 : value;
  return Math.round(metres * 10_000) / 10_000;
}

export async function encodePublicJobSearchCursor({
  filters,
  payload,
  key,
  randomBytes,
}: {
  filters: PublicJobSearchFilters;
  payload: PublicJobSearchCursorPayload;
  key: Uint8Array;
  randomBytes?: (length: number) => Uint8Array;
}) {
  if (!validCursorPayload(payload) || key.length !== 32) return null;
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return null;
  const iv = randomBytes
    ? randomBytes(12)
    : cryptoApi.getRandomValues(new Uint8Array(12));
  if (!(iv instanceof Uint8Array) || iv.length !== 12) return null;
  const fingerprint = await publicJobSearchFingerprint(filters);
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ v: 1, f: fingerprint, ...payload }),
  );
  const cryptoKey = await cryptoApi.subtle.importKey(
    "raw",
    ownedArrayBuffer(key),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ownedArrayBuffer(iv),
      additionalData: new TextEncoder().encode("bluedeck-public-job-search-v1"),
    },
    cryptoKey,
    plaintext,
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function decodePublicJobSearchCursor({
  filters,
  token,
  key,
}: {
  filters: PublicJobSearchFilters;
  token: string;
  key: Uint8Array;
}): Promise<PublicJobSearchCursorPayload | null> {
  if (
    key.length !== 32 ||
    token.length > maximumPublicJobSearchCursorLength ||
    !encryptedCursorPattern.test(token)
  ) {
    return null;
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return null;
  try {
    const [, ivValue, ciphertextValue] = token.split(".");
    const iv = base64UrlDecode(ivValue);
    const ciphertext = base64UrlDecode(ciphertextValue);
    if (!iv || iv.length !== 12 || !ciphertext || ciphertext.length < 17) {
      return null;
    }
    const cryptoKey = await cryptoApi.subtle.importKey(
      "raw",
      ownedArrayBuffer(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintext = await cryptoApi.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ownedArrayBuffer(iv),
        additionalData: new TextEncoder().encode("bluedeck-public-job-search-v1"),
      },
      cryptoKey,
      ownedArrayBuffer(ciphertext),
    );
    const value = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    if (!isRecord(value) || value.v !== 1 || typeof value.f !== "string") {
      return null;
    }
    if (value.f !== (await publicJobSearchFingerprint(filters))) return null;
    const payload = {
      snapshotAt: value.snapshotAt,
      resultFingerprint: value.resultFingerprint,
      total: value.total,
      anchor: value.anchor,
    };
    return validCursorPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function publicJobSearchResultFingerprint(
  jobs: readonly PublicJobPost[],
) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return null;
  const canonical = jobs.map((job) => [
    job.id,
    job.listingNumber,
    job.title,
    job.position,
    job.department,
    job.employmentType,
    job.candidateType,
    job.smokerPolicy,
    job.visibleTattooPolicy,
    job.requiredLanguages,
    job.requiredSkills,
    job.requiredCharacteristics,
    job.requiredCertificates,
    job.requiredVisas,
    job.yachtBrand,
    job.yachtFlagCountryCode,
    job.yachtBuildYear,
    job.yachtType,
    job.yachtProgram,
    job.yachtLength,
    job.yachtLengthUnit,
    job.crewMemberCount,
    job.minimumYachtExperience,
    job.location,
    job.startDate,
    job.summary,
    job.description,
    job.responsibilities,
    job.requirements,
    job.benefits,
    job.salary
      ? [
          job.salary.min,
          job.salary.max,
          job.salary.currency,
          job.salary.period,
        ]
      : null,
    job.publishedAt,
  ]);
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function publicJobSearchFingerprint(filters: PublicJobSearchFilters) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalPublicJobSearchFilters(filters)),
  );
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function publicJobSearchDocument(job: PublicJobPost) {
  const aliases = [
    employmentAliases[job.employmentType],
    candidateAliases[job.candidateType],
    yachtAliases[job.yachtType || ""],
    yachtProgramAliases[job.yachtProgram || ""],
    smokerAliases[job.smokerPolicy],
    tattooAliases[job.visibleTattooPolicy],
    experienceAliases[job.minimumYachtExperience || ""],
  ];
  return [
    job.listingNumber,
    `#${job.listingNumber}`,
    job.title,
    job.position,
    job.department,
    job.employmentType,
    job.candidateType,
    job.location,
    job.startDate || "",
    job.yachtBrand || "",
    job.yachtFlagCountryCode || "",
    job.yachtBuildYear === null ? "" : String(job.yachtBuildYear),
    job.yachtType || "",
    job.yachtProgram || "",
    job.yachtLength === null ? "" : String(job.yachtLength),
    job.yachtLengthUnit || "",
    job.crewMemberCount === null ? "" : String(job.crewMemberCount),
    job.minimumYachtExperience || "",
    job.smokerPolicy,
    job.visibleTattooPolicy,
    ...aliases,
    ...job.requiredLanguages,
    ...job.requiredSkills,
    ...job.requiredCharacteristics,
    ...job.requiredCertificates,
    ...job.requiredVisas,
    job.summary,
    job.description,
    ...job.responsibilities,
    ...job.requirements,
    ...job.benefits,
    job.salary?.currency || "",
    job.salary?.period || "",
    job.salary?.min === null || job.salary?.min === undefined
      ? ""
      : String(job.salary.min),
    job.salary?.max === null || job.salary?.max === undefined
      ? ""
      : String(job.salary.max),
    job.publishedAt,
  ].join(" ");
}

const employmentAliases: Record<string, string> = {
  permanent: "permanent sürekli surekli",
  temporary: "temporary geçici gecici",
  seasonal: "seasonal sezonluk",
  rotation: "rotation rotasyon",
  daywork: "daywork günlük gunluk",
};
const candidateAliases: Record<string, string> = {
  any: "any either fark etmez tümü tumu",
  individual: "individual bireysel",
  team: "team ekip couple çift cift",
  couple: "couple çift cift",
};
const yachtAliases: Record<string, string> = {
  motor_yacht: "motor yacht motor yat",
  sailing_yacht: "sailing yacht yelkenli yat",
  catamaran: "catamaran katamaran",
  motor_catamaran: "motor catamaran motor katamaran",
  gulet: "gulet",
  expedition_yacht: "expedition yacht expedition yat",
  classic_yacht: "classic yacht klasik yat",
  support_vessel: "support vessel destek teknesi",
  chase_boat: "chase boat takip botu",
  commercial_vessel: "commercial vessel ticari tekne",
  new_build: "new build yeni inşa insa",
};

const yachtProgramAliases: Record<string, string> = {
  private: "private özel ozel",
  charter: "charter kiralama",
  private_charter: "private charter private & charter özel kiralama ozel",
};
const smokerAliases: Record<string, string> = {
  no_preference: "no preference tercih yok",
  non_smoker: "non smoker nonsmoker sigara içmeyen icmeyen",
  smoker_accepted: "smoker accepted sigara kabul",
};
const tattooAliases: Record<string, string> = {
  no_preference: "no preference tercih yok",
  not_accepted: "no visible tattoos görünür dövme olmamalı gorunur dovme olmamali",
  accepted: "visible tattoos accepted görünür dövme kabul gorunur dovme",
};
const experienceAliases: Record<string, string> = {
  "0_6_months": "0 6 months ay",
  "1_year": "1 year yıl yil",
  "2_years": "2 years yıl yil",
  "3_years": "3 years yıl yil",
  "1_3_years": "1 3 years yıl yil",
  "3_5_years": "3 5 years yıl yil",
  "5_plus_years": "5 plus years yıl yil",
  "5_10_years": "5 10 years yıl yil",
  "10_plus_years": "10 plus years yıl yil",
  "15_plus_years": "15 plus years yıl yil",
  "20_plus_years": "20 plus years yıl yil",
};

function keywordMatches(document: string, query: string) {
  const haystack = foldText(document);
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function foldText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function enumList<Option extends string>(
  params: URLSearchParams,
  key: string,
  options: readonly Option[],
  normalize: (value: string) => string = (value) => value,
): { ok: true; value: Option[] } | { ok: false; error: string } {
  const values = params.getAll(key);
  if (values.length > (multiValueLimits[key] || options.length)) {
    return { ok: false, error: `Too many ${key} filters were selected.` };
  }
  const allowed = new Set<string>(options);
  const result: Option[] = [];
  for (const value of values) {
    const normalized = normalize(value);
    if (!allowed.has(normalized)) {
      return { ok: false, error: `The ${key} filter is invalid.` };
    }
    if (!result.includes(normalized as Option)) result.push(normalized as Option);
  }
  return { ok: true, value: canonicalList(result) };
}

function optionalEnum<Option extends string>(
  value: string | null,
  options: readonly Option[],
): Option | null | undefined {
  if (value === null || value === "") return null;
  return options.includes(value as Option) ? (value as Option) : undefined;
}

function boundedText(value: string | null, maximumLength: number) {
  if (value === null || value === "") return "";
  const text = value.trim().replace(/\s+/g, " ");
  if (
    text.length > maximumLength ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    return null;
  }
  return text;
}

function integerFilter(value: string | null, minimum: number, maximum: number) {
  if (value === null || value === "") {
    return { ok: true as const, value: null };
  }
  if (!/^\d+$/.test(value)) return { ok: false as const };
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? { ok: true as const, value: number }
    : { ok: false as const };
}

function steppedIntegerFilter(
  value: string | null,
  minimum: number,
  maximum: number,
  step: number,
) {
  const result = integerFilter(value, minimum, maximum);
  if (!result.ok || result.value === null) return result;
  return (result.value - minimum) % step === 0
    ? result
    : { ok: false as const };
}

function reversed(minimum: number | null, maximum: number | null) {
  return minimum !== null && maximum !== null && minimum > maximum;
}

function successfulList<Option extends string>(
  result: { ok: true; value: Option[] } | { ok: false; error: string },
) {
  return result.ok ? result.value : [];
}

function numericValue(
  result: { ok: true; value: number | null } | { ok: false },
) {
  return result.ok ? result.value : null;
}

function canonicalList<Option extends string>(values: readonly Option[]) {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
}

function setText(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

function setList(params: URLSearchParams, key: string, values: readonly string[]) {
  for (const value of canonicalList(values)) params.append(key, value);
}

function setNumber(
  params: URLSearchParams,
  key: string,
  value: number | null,
) {
  if (value !== null) params.set(key, String(value));
}

function includesSelected<Option extends string>(
  selected: readonly Option[],
  value: Option | null,
) {
  return selected.length === 0 || (value !== null && selected.includes(value));
}

function matchesCandidateType(
  selected: readonly JobCandidateType[],
  value: JobCandidateType,
) {
  return value === "any" || includesSelected(selected, value);
}

function compareNullablePrimary(
  left: string | number | null,
  right: string | number | null,
  descending: boolean,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
  return descending ? -result : result;
}

function validCursorPayload(value: unknown): value is PublicJobSearchCursorPayload {
  if (!isRecord(value) || !isRecord(value.anchor)) return false;
  const snapshotAt = value.snapshotAt;
  const anchor = value.anchor;
  const primary = anchor.primary;
  return (
    typeof snapshotAt === "string" &&
    snapshotAt.length <= 64 &&
    Number.isFinite(Date.parse(snapshotAt)) &&
    typeof value.resultFingerprint === "string" &&
    /^[0-9a-f]{64}$/.test(value.resultFingerprint) &&
    typeof value.total === "number" &&
    Number.isSafeInteger(value.total) &&
    value.total >= 0 &&
    value.total <= 100_000 &&
    (primary === null ||
      typeof primary === "string" ||
      (typeof primary === "number" && Number.isFinite(primary))) &&
    typeof anchor.publishedAt === "string" &&
    anchor.publishedAt.length <= 64 &&
    Number.isFinite(Date.parse(anchor.publishedAt)) &&
    typeof anchor.id === "string" &&
    uuidPattern.test(anchor.id)
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function ownedArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

function base64UrlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
