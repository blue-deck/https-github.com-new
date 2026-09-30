import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard keeps an editable identity beside a direct dashboard heading", async () => {
  const dashboard = await readFile(new URL("app/dashboard/page.tsx", root), "utf8");
  const labelIndex = dashboard.indexOf('t("dashboard.myDashboard")');
  const identityRowIndex = dashboard.indexOf(
    'className={styles.identity}',
  );
  const photoIndex = dashboard.indexOf("<DashboardPhotoControl", identityRowIndex);
  const nameIndex = dashboard.indexOf('className={styles.name}', photoIndex);
  const roleIndex = dashboard.indexOf('t("dashboard.role")', nameIndex);
  const teamCoupleIndex = dashboard.indexOf("<TeamCouplePanel />", roleIndex);

  assert.ok(labelIndex >= 0);
  assert.ok(identityRowIndex > labelIndex);
  assert.ok(photoIndex > identityRowIndex);
  assert.ok(nameIndex > photoIndex);
  assert.ok(roleIndex > nameIndex);
  assert.ok(teamCoupleIndex > roleIndex);
  assert.doesNotMatch(dashboard, /dashboard\.welcome/);
  assert.equal(dashboard.match(/<TeamCouplePanel \/>/g)?.length, 1);
});
