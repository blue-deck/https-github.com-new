export const maximumJobSalaryAmount = 1_000_000;

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeJobSalaryAmountInput(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  const amount = Number(normalizedDigits);
  const boundedAmount =
    Number.isSafeInteger(amount) && amount <= maximumJobSalaryAmount
      ? amount
      : maximumJobSalaryAmount;
  return formatJobSalaryAmountInput(boundedAmount);
}

/**
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatJobSalaryAmountInput(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    return normalizeJobSalaryAmountInput(value);
  }
  if (!Number.isFinite(value) || value < 0) return "";

  const digits = String(Math.trunc(value));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * @param {string} value
 * @returns {number | null}
 */
export function parseJobSalaryAmountInput(value) {
  const displayValue = value.trim();
  if (!displayValue) return null;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(displayValue)) return null;

  const normalized = displayValue.replace(/\./g, "");
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= maximumJobSalaryAmount
    ? amount
    : null;
}
