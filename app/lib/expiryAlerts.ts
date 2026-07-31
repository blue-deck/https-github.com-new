const millisecondsPerDay = 24 * 60 * 60 * 1000;

export type ExpiryAlertLevel =
  | "normal"
  | "warning"
  | "critical"
  | "expired";

type ExpiryAlertRecord = {
  source_type?: string | null;
  source_id?: string | null;
  status?: string | null;
  expiry_date?: string | null;
};

type ExpiringDocumentRecord = {
  id: string;
  expiry_date?: string | null;
};

export function daysUntilExpiry(
  dateString: string | null | undefined,
  now = new Date(),
) {
  const expiry = parseIsoDate(dateString);
  if (!expiry) return null;

  return Math.ceil(
    (expiry.getTime() - todayAsUtcDate(now).getTime()) / millisecondsPerDay,
  );
}

export function calculateExpiryAlertLevel(
  dateString: string | null | undefined,
  now = new Date(),
): ExpiryAlertLevel {
  const days = daysUntilExpiry(dateString, now);

  if (days === null) return "normal";
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 30) return "warning";

  return "normal";
}

export function isInsideThreeMonthAlertWindow(
  dateString: string | null | undefined,
  now = new Date(),
) {
  const expiry = parseIsoDate(dateString);
  if (!expiry) return false;

  return (
    expiry.getTime() <= addUtcCalendarMonths(todayAsUtcDate(now), 3).getTime()
  );
}

export function expiryAlertWindowEndIso(now = new Date()) {
  return formatIsoDate(addUtcCalendarMonths(todayAsUtcDate(now), 3));
}

export function countActiveExpiryAlerts(
  alerts: ExpiryAlertRecord[],
  documents: ExpiringDocumentRecord[],
  now = new Date(),
) {
  const persistedDocumentIds = new Set(
    alerts
      .filter(
        (alert) => alert.source_type === "document" && alert.source_id,
      )
      .map((alert) => alert.source_id as string),
  );
  const persistedActiveCount = alerts.filter(
    (alert) =>
      alert.status !== "resolved" &&
      isInsideThreeMonthAlertWindow(alert.expiry_date, now),
  ).length;
  const automaticDocumentCount = documents.filter(
    (document) =>
      !persistedDocumentIds.has(document.id) &&
      isInsideThreeMonthAlertWindow(document.expiry_date, now),
  ).length;

  return persistedActiveCount + automaticDocumentCount;
}

function parseIsoDate(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function todayAsUtcDate(now: Date) {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
}

function addUtcCalendarMonths(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonthStart = new Date(Date.UTC(year, month + months, 1));
  const targetMonthEnd = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0,
    ),
  );

  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(day, targetMonthEnd.getUTCDate()),
    ),
  );
}

function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
