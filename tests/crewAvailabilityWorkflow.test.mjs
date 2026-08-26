import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applicationCandidateAvailabilityStatus,
} from "../app/lib/jobApplications.ts";

test("Find Crew excludes explicit unavailability at list and direct-profile boundaries", async () => {
  const source = await readFile(
    new URL("../app/lib/findCrewData.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /pageRows\.filter\(\(row\) =>\s*isCrewVisibleInDirectory\(parseCrewDiscoverySettings\(text\(row\.notes\)\)\)/,
  );
  assert.match(
    source,
    /const discovery = getPublicCrewDiscoverySettings\(profile\.notes\);\s*if \(!isCrewVisibleInDirectory\(discovery\)\) return null;/,
  );
  assert.match(
    source,
    /availabilityStatus: identitySafeProfileField\(\s*discovery\.availabilityStatus/,
  );
  assert.doesNotMatch(source, /hasSavedDiscoverySettings/);
});

test("job applicants are presented as Open to offers without mutating profile availability", async () => {
  const [server, manager, applicationRoute] = await Promise.all([
    readFile(
      new URL("../app/lib/jobApplicationsServer.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/hiring/jobs/[id]/applications/JobApplicationsManager.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/api/jobs/[id]/application/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.equal(applicationCandidateAvailabilityStatus, "Open to offers");
  assert.match(
    server,
    /availabilityStatus: applicationCandidateAvailabilityStatus/,
  );
  assert.match(
    manager,
    /value\.availabilityStatus !== applicationCandidateAvailabilityStatus/,
  );
  assert.match(applicationRoute, /bluedeck_submit_job_application_v2/);
  assert.doesNotMatch(applicationRoute, /\.from\("crew_profiles"\)/);
  assert.doesNotMatch(applicationRoute, /availabilityStatus|Not available/);
});

test("directory migration defaults missing values without rewriting private notes", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260826143000_default_available_directory_visibility.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /create or replace function private\.bluedeck_crew_availability_status/,
  );
  assert.match(migration, /when 'Currently employed' then 'Not available'/);
  assert.match(migration, /else 'Available'/);
  assert.equal(
    migration.match(
      /private\.bluedeck_crew_availability_status\(profile\.notes\) <>/g,
    )?.length,
    2,
  );
  assert.doesNotMatch(migration, /update public\.crew_profiles/);
  assert.match(migration, /security definer/g);
  assert.match(migration, /set search_path = pg_catalog, public, private/g);
});
