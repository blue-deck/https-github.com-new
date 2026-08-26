import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard places the profile photo below its label and left of account details", async () => {
  const dashboard = await readFile(new URL("app/dashboard/page.tsx", root), "utf8");
  const labelIndex = dashboard.indexOf('t("dashboard.myDashboard")');
  const identityRowIndex = dashboard.indexOf(
    'className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:items-center sm:gap-6"',
  );
  const photoIndex = dashboard.indexOf("<DashboardPhotoControl", identityRowIndex);
  const welcomeIndex = dashboard.indexOf('t("dashboard.welcome")', photoIndex);
  const roleIndex = dashboard.indexOf('t("dashboard.role")', welcomeIndex);
  const teamCoupleIndex = dashboard.indexOf("<TeamCouplePanel />", roleIndex);

  assert.ok(labelIndex >= 0);
  assert.ok(identityRowIndex > labelIndex);
  assert.ok(photoIndex > identityRowIndex);
  assert.ok(welcomeIndex > photoIndex);
  assert.ok(roleIndex > welcomeIndex);
  assert.ok(teamCoupleIndex > roleIndex);
});
