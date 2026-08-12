import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("withdrawn applications reopen the candidate application form", async () => {
  const [panel, candidateRoute] = await Promise.all([
    source("app/jobs/[id]/JobApplicationPanel.tsx"),
    source("app/api/jobs/[id]/application/route.ts"),
  ]);

  assert.match(
    panel,
    /loadedApplication\?\.status === "withdrawn" \? null : loadedApplication/,
  );
  assert.match(
    panel,
    /nextApplication\.status !== "withdrawn"[\s\S]*setApplication\(null\)/,
  );
  assert.match(panel, /You can apply again now/);
  assert.match(panel, /Şimdi yeniden başvurabilirsiniz/);
  assert.match(panel, /notice\.tone === "success" \? "text-emerald-800"/);
  assert.equal(
    (candidateRoute.match(/\.neq\("status", "withdrawn"\)/g) || []).length,
    2,
  );
});

test("employer detail and media boundaries reject withdrawn applications", async () => {
  const [employerRoute, mediaRoute] = await Promise.all([
    source(
      "app/api/employer/job-posts/[id]/applications/[applicationId]/route.ts",
    ),
    source(
      "app/api/employer/job-posts/[id]/applications/[applicationId]/media/route.ts",
    ),
  ]);

  assert.equal(
    (employerRoute.match(/\.neq\("status", "withdrawn"\)/g) || []).length,
    2,
  );
  assert.match(mediaRoute, /\.neq\("status", "withdrawn"\)/);
});
