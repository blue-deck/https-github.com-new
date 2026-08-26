import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatJobSalaryAmountInput,
  maximumJobSalaryAmount,
  normalizeJobSalaryAmountInput,
  parseJobSalaryAmountInput,
} from "../app/lib/jobSalaryAmount.js";

test("salary input groups whole-number amounts with dots", () => {
  assert.equal(formatJobSalaryAmountInput(null), "");
  assert.equal(formatJobSalaryAmountInput(999), "999");
  assert.equal(formatJobSalaryAmountInput(1_000), "1.000");
  assert.equal(formatJobSalaryAmountInput(10_000), "10.000");
  assert.equal(formatJobSalaryAmountInput(999_999), "999.999");
  assert.equal(
    formatJobSalaryAmountInput(maximumJobSalaryAmount),
    "1.000.000",
  );
});

test("salary input normalizes typing and caps the visible amount", () => {
  assert.equal(normalizeJobSalaryAmountInput(""), "");
  assert.equal(normalizeJobSalaryAmountInput("00010"), "10");
  assert.equal(normalizeJobSalaryAmountInput("1000"), "1.000");
  assert.equal(normalizeJobSalaryAmountInput("10.000"), "10.000");
  assert.equal(normalizeJobSalaryAmountInput("1000001"), "1.000.000");
});

test("salary input parses grouped display values back to bounded integers", () => {
  assert.equal(parseJobSalaryAmountInput(""), null);
  assert.equal(parseJobSalaryAmountInput("1.000"), 1_000);
  assert.equal(parseJobSalaryAmountInput("10.000"), 10_000);
  assert.equal(parseJobSalaryAmountInput("1.000.000"), 1_000_000);
  assert.equal(parseJobSalaryAmountInput("1.000.001"), null);
  assert.equal(parseJobSalaryAmountInput("1000.5"), null);
  assert.equal(parseJobSalaryAmountInput("1,000"), null);
  assert.equal(parseJobSalaryAmountInput("salary"), null);
  assert.equal(parseJobSalaryAmountInput("-1"), null);
});

test("job post mutations enforce the same whole-number salary ceiling", async () => {
  const server = await readFile(
    new URL("../app/lib/jobPostsServer.ts", import.meta.url),
    "utf8",
  );
  const start = server.indexOf("function optionalMoney(");
  const end = server.indexOf("function optionalJobYachtType", start);
  const optionalMoney = server.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(server, /maximumJobSalaryAmount,/);
  assert.match(optionalMoney, /Number\.isSafeInteger\(value\)/);
  assert.match(optionalMoney, /value > maximumJobSalaryAmount/);
  assert.doesNotMatch(optionalMoney, /99_999_999\.99|Math\.round/);
  assert.match(
    server,
    /Salary values must be whole numbers between 0 and 1,000,000\./,
  );
});
