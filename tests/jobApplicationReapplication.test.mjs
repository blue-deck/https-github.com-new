import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("withdrawn attempts release active uniqueness without deleting history", async () => {
  const migration = await source(
    "supabase/migrations/20260812075135_allow_reapplication_after_withdrawal.sql",
  );

  assert.match(
    migration,
    /create unique index job_applications_job_applicant_nonwithdrawn_uidx[\s\S]*where status <> 'withdrawn'/,
  );
  assert.match(
    migration,
    /primary key \(job_post_id, member_user_id\)/,
  );
  assert.match(
    migration,
    /new\.status = 'withdrawn'[\s\S]*delete from private\.bluedeck_job_application_member_reservations/,
  );
  assert.match(
    migration,
    /drop index public\.job_applications_job_applicant_uidx/,
  );
  assert.match(
    migration,
    /drop index public\.job_application_team_members_job_user_uidx/,
  );
  assert.match(
    migration,
    /where reservation\.job_post_id = p_job_post_id[\s\S]*reservation\.member_user_id = any\(member_ids\)/,
  );
});

test("employer database reads consistently hide withdrawn applications", async () => {
  const migration = await source(
    "supabase/migrations/20260812075135_allow_reapplication_after_withdrawal.sql",
  );

  const filters = migration.match(/application\.status <> 'withdrawn'/g) || [];
  assert.ok(filters.length >= 5, "all list, count, total, and page reads must filter");
  assert.match(
    migration,
    /left join public\.job_applications as application[\s\S]*and application\.status <> 'withdrawn'/,
  );
  assert.match(
    migration,
    /create index job_applications_employer_visible_page_idx[\s\S]*where status <> 'withdrawn'/,
  );
});

test("candidate and employer HTTP boundaries use only the active attempt", async () => {
  const [candidateRoute, employerRoute, mediaRoute] = await Promise.all([
    source("app/api/jobs/[id]/application/route.ts"),
    source("app/api/employer/job-posts/[id]/applications/[applicationId]/route.ts"),
    source(
      "app/api/employer/job-posts/[id]/applications/[applicationId]/media/route.ts",
    ),
  ]);

  assert.match(candidateRoute, /bluedeck_current_job_application_membership/);
  assert.ok(
    (candidateRoute.match(/\.neq\("status", "withdrawn"\)/g) || []).length >= 2,
  );
  assert.ok(
    (employerRoute.match(/\.neq\("status", "withdrawn"\)/g) || []).length >= 2,
  );
  assert.match(mediaRoute, /\.neq\("status", "withdrawn"\)/);
  assert.match(mediaRoute, /!applicationResult\.data/);
});

test("withdrawal immediately reopens the application form and employer list refreshes", async () => {
  const [panel, manager] = await Promise.all([
    source("app/jobs/[id]/JobApplicationPanel.tsx"),
    source("app/hiring/jobs/[id]/applications/JobApplicationsManager.tsx"),
  ]);

  assert.match(
    panel,
    /nextApplication\.status !== "withdrawn"[\s\S]*setApplication\(null\)[\s\S]*setCanWithdraw\(false\)/,
  );
  assert.match(panel, /Şimdi yeniden başvurabilirsiniz/);
  assert.match(manager, /setInterval\(refreshVisibleWorkspace, 15_000\)/);
  assert.match(manager, /visibilitychange/);
  assert.match(manager, /if \(!profileOpen \|\| selected\) return/);
});

