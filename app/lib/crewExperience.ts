export type CrewExperienceDateRange = {
  yacht_type?: unknown;
  start_date?: unknown;
  end_date?: unknown;
};

const otherWorkExperienceMarker = "__BLUDECK_OTHER_WORK__";
const millisecondsPerDay = 86_400_000;
const averageDaysPerYear = 365.2425;
const maximumCredibleExperienceYears = 80;

export function crewExperienceYearsFromDateRanges(
  experiences: CrewExperienceDateRange[],
  currentDate = new Date(),
) {
  const currentDay = utcDay(currentDate);
  if (currentDay === null) return 0;

  const ranges = experiences
    .filter(
      (experience) =>
        cleanText(experience.yacht_type) !== otherWorkExperienceMarker,
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
  return Math.min(
    maximumCredibleExperienceYears,
    Math.max(0.1, Math.round((totalDays / averageDaysPerYear) * 10) / 10),
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
