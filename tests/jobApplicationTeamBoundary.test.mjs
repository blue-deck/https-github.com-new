import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("employer application lists keep team rows identity-only and lazy-load snapshots", async () => {
  const server = await source("app/lib/jobApplicationsServer.ts");
  const identitySelect = server.match(
    /export const jobApplicationTeamMemberSelect =\s*\n?\s*"([^"]+)"/,
  )?.[1];

  assert.ok(identitySelect);
  assert.match(identitySelect, /member_name_snapshot/);
  assert.match(identitySelect, /member_position_snapshot/);
  assert.doesNotMatch(identitySelect, /candidate_snapshot|media_snapshot/);
  assert.match(
    server,
    /const jobApplicationTeamMemberSnapshotSelect =\s*\n?\s*"[^"]*candidate_snapshot[^"]*media_snapshot[^"]*"/,
  );
  assert.match(
    server,
    /loadApplicationTeamMemberSnapshots\(\s*serviceClient,\s*missingPrimarySnapshots/,
  );
  assert.match(
    server,
    /if \(!snapshot\) \{[\s\S]*?loadApplicationTeamMemberSnapshots\(\s*serviceClient,\s*\[member\]/,
  );
});

test("unsafe candidate names fall back instead of poisoning an employer page", async () => {
  const server = await source("app/lib/jobApplicationsServer.ts");

  assert.match(
    server,
    /const memberName =\s*[\s\S]*?publicStructuredProfileField\(value\.member_name_snapshot, 120\) \|\|\s*"BlueDeck candidate"/,
  );
  assert.doesNotMatch(
    server,
    /\(memberRole !== "crew" && memberRole !== "captain"\) \|\|\s*!memberName/,
  );
});

test("retained profile snapshots survive crew-profile deletion without exposing media", async () => {
  const server = await source("app/lib/jobApplicationsServer.ts");

  assert.doesNotMatch(
    server,
    /if \(!snapshot \|\| !isUuid\(member\.crewProfileId\)\)/,
  );
  assert.match(
    server,
    /const mediaOwnerIds = applicationMemberMediaOwnerIds\(member\)/,
  );
  assert.match(
    server,
    /return isUuid\(member\.memberUserId\) && isUuid\(member\.crewProfileId\)[\s\S]*?\? \[member\.crewProfileId, member\.memberUserId\][\s\S]*?: \[\]/,
  );
  assert.match(
    server,
    /const avatarSource = mediaOwnerIds\.length[\s\S]*?: ""/,
  );
  assert.match(
    server,
    /const gallerySources = mediaOwnerIds\.length[\s\S]*?: \[\]/,
  );
});

test("primary media falls back to its child snapshot only after a clean legacy miss", async () => {
  const route = await source(
    "app/api/employer/job-posts/[id]/applications/[applicationId]/media/route.ts",
  );

  assert.match(route, /let snapshot: ApplicationMediaRow \| null = member/);
  assert.match(
    route,
    /if \(result\.error\) return mediaError\("Media not found\.", 404\)/,
  );
  assert.match(route, /if \(result\.data\) snapshot = result\.data/);
  assert.match(route, /\.eq\("id", capability\.memberId\)/);
  assert.match(route, /\.eq\("application_id", capability\.applicationId\)/);
  assert.match(route, /\.eq\("job_post_id", capability\.jobPostId\)/);
});

test("member identity is signed into every employer media capability", async () => {
  const media = await source("app/lib/jobApplicationMediaServer.ts");

  assert.match(media, /member: normalized\.memberId/);
  assert.match(
    media,
    /normalized\.jobPostId,[\s\S]*?normalized\.applicationId,[\s\S]*?normalized\.memberId,[\s\S]*?normalized\.kind/,
  );
  assert.match(
    media,
    /jobPostId,[\s\S]*?applicationId,[\s\S]*?memberId,[\s\S]*?kind,[\s\S]*?revision,[\s\S]*?String\(expiresAt\)/,
  );
});

test("database application ceilings return a general rate-limit response", async () => {
  const route = await source("app/api/jobs/[id]/application/route.ts");

  assert.match(
    route,
    /code === "54000"[\s\S]*?"An application limit has been reached\. Please try again later\."/,
  );
  assert.match(route, /code === "54000"\s*\? 429/);
  assert.doesNotMatch(
    route,
    /code === "54000"[\s\S]{0,120}Team\/Couple member limit/,
  );
});

test("team application options expose only currently available relationships", async () => {
  const route = await source("app/api/jobs/[id]/application/route.ts");

  assert.match(
    route,
    /teamDashboard\?\.members\.filter\(\(member\) => member\.isAvailable\)/,
  );
  assert.match(
    route,
    /teamMembers: teamApplicationAllowed \? availableTeamMembers : \[\]/,
  );
});

test("application hydration binds the primary team member to the parent applicant", async () => {
  const server = await source("app/lib/jobApplicationsServer.ts");

  assert.match(server, /const applicantUserId = cleanText\(value\.applicant_user_id\)/);
  assert.match(
    server,
    /primaryMembers\[0\]\.memberUserId === target\.applicantUserId/,
  );
});

test("secondary members cannot receive the primary applicant's private note", async () => {
  const [route, portalServer] = await Promise.all([
    source("app/api/jobs/[id]/application/route.ts"),
    source("app/lib/myJobApplicationsServer.ts"),
  ]);

  assert.match(route, /application && !isPrimaryApplicant[\s\S]*?coverNote: ""/);
  assert.match(
    portalServer,
    /primaryApplicantUserId === authenticatedUserId[\s\S]*?: \{ \.\.\.application, coverNote: "" \}/,
  );
});

test("a committed employer status update requests refresh instead of reporting failure", async () => {
  const [route, manager] = await Promise.all([
    source(
      "app/api/employer/job-posts/[id]/applications/[applicationId]/route.ts",
    ),
    source("app/hiring/jobs/[id]/applications/JobApplicationsManager.tsx"),
  ]);

  assert.match(route, /ok: true,[\s\S]*?refreshRequired: true/);
  assert.match(manager, /payload\.refreshRequired === true/);
  assert.match(manager, /setReloadVersion\(\(current\) => current \+ 1\)/);
});
