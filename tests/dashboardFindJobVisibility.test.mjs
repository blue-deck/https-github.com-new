import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard omits Find Job while retaining My Applications", async () => {
  const dashboard = await readFile(new URL("app/dashboard/page.tsx", root), "utf8");

  assert.doesNotMatch(dashboard, /href="\/jobs"/);
  assert.doesNotMatch(dashboard, /dashboard\.findJob/);
  assert.match(dashboard, /href="\/portal\/applications"/);
});
