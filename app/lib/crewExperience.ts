export type CrewExperienceDateRange = {
  yacht_type?: unknown;
  start_date?: unknown;
  end_date?: unknown;
};

export type CrewExperienceBreakdown = {
  yachtYears: number;
  otherYears: number;
};

export const otherWorkExperienceMarker = "__BLUDECK_OTHER_WORK__";
const millisecondsPerDay = 86_400_000;
const daysPerExperienceYear = 365;
const maximumCredibleExperienceYears = 80;
const exactExperiencePrecision = 10_000;

export function crewExperienceYearsFromDateRanges(
  experiences: CrewExperienceDateRange[],
  currentDate = new Date(),
) {
  return roundedExperienceYears(
    crewExperienceBreakdownFromDateRanges(experiences, currentDate).yachtYears,
  );
}

export function crewExperienceBreakdownFromDateRanges(
  experiences: CrewExperienceDateRange[],
  currentDate = new Date(),
): CrewExperienceBreakdown {
  const currentDay = utcDay(currentDate);
  if (currentDay === null) return { yachtYears: 0, otherYears: 0 };

  return {
    yachtYears: experienceYearsForType(experiences, currentDay, "yacht"),
    otherYears: experienceYearsForType(experiences, currentDay, "other"),
  };
}

export function formatCrewExperienceDuration(
  years: number,
  language: "en" | "tr",
) {
  if (!Number.isFinite(years) || years <= 0) return "0";
  if (years <= 0.5) return language === "tr" ? "0–6 ay" : "0–6 months";
  if (years < 1) return language === "tr" ? "6–12 ay" : "6–12 months";

  const completedYears = Math.floor(years);
  return language === "tr"
    ? `${completedYears}+ yıl`
    : `${completedYears}+ years`;
}

function experienceYearsForType(
  experiences: CrewExperienceDateRange[],
  currentDay: number,
  type: "yacht" | "other",
) {
  const expectsOtherWork = type === "other";

  const ranges = experiences
    .filter(
      (experience) =>
        (cleanText(experience.yacht_type) === otherWorkExperienceMarker) ===
        expectsOtherWork,
    )
    .map((experience) => {
      const start = utcDay(experience.start_date);
      const rawEnd = cleanText(experience.end_date);
      const recordedEnd = rawEnd ? utcDay(rawEnd) : currentDay;
      if (
        start === null ||
        recordedEnd === null ||
        start > currentDay
      ) {
        return null;
      }
      const endExclusive = Math.min(recordedEnd, currentDay) + 1;
      return endExclusive > start ? { start, endExclusive } : null;
    })
    .filter(
      (range): range is { start: number; endExclusive: number } =>
        Boolean(range),
    )
    .sort((left, right) => left.start - right.start);

  let totalDays = 0;
  let activeStart: number | null = null;
  let activeEnd = 0;
  for (const range of ranges) {
    if (activeStart === null) {
      activeStart = range.start;
      activeEnd = range.endExclusive;
      continue;
    }
    if (range.start <= activeEnd) {
      activeEnd = Math.max(activeEnd, range.endExclusive);
      continue;
    }
    totalDays += activeEnd - activeStart;
    activeStart = range.start;
    activeEnd = range.endExclusive;
  }
  if (activeStart !== null) totalDays += activeEnd - activeStart;

  if (totalDays <= 0) return 0;
  const exactYears = Math.min(
    maximumCredibleExperienceYears,
    totalDays / daysPerExperienceYear,
  );
  return Math.floor(exactYears * exactExperiencePrecision) /
    exactExperiencePrecision;
}

function roundedExperienceYears(years: number) {
  if (!Number.isFinite(years) || years <= 0) return 0;
  return Math.min(
    maximumCredibleExperienceYears,
    Math.max(0.1, Math.round(years * 10) / 10),
  );
}

function utcDay(value: unknown) {
  if (value instanceof Date && !Number.isFinite(value.getTime())) return null;
  const dateText = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : cleanText(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const milliseconds = Date.parse(`${dateText}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds)) return null;
  const canonical = new Date(milliseconds).toISOString().slice(0, 10);
  return canonical === dateText ? Math.floor(milliseconds / millisecondsPerDay) : null;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
