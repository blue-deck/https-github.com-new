import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isTeamCoupleRelationshipId,
  isTeamCoupleVersion,
  maximumTeamCoupleCrewIdLength,
  normalizeTeamCoupleCrewId,
  parseTeamCoupleDashboard,
} from "../app/lib/teamCouple.ts";

const root = new URL("../", import.meta.url);
const relationshipId = "11111111-1111-4111-8111-111111111111";
const secondRelationshipId = "22222222-2222-4222-8222-222222222222";

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function person(overrides = {}) {
  return {
    relationshipId,
    version: 1,
    publicCrewId: "BD-CREW_01",
    fullName: "Ada Lovelace",
    currentPosition: "Chief Stewardess",
    accountRole: "crew",
    isAvailable: true,
    ...overrides,
  };
}

function invitation(overrides = {}) {
  return {
    ...person(),
    invitedAt: "2026-08-11T08:30:00+03:00",
    ...overrides,
  };
}

function dashboard(overrides = {}) {
  return {
    ownCrewId: "BD-OWNER_01",
    members: [person()],
    incomingInvites: [
      invitation({
        relationshipId: secondRelationshipId,
        publicCrewId: "BD-CAPTAIN_02",
        fullName: "Grace Hopper",
        currentPosition: "Captain",
        accountRole: "captain",
      }),
    ],
    outgoingInvites: [],
    ...overrides,
  };
}

test("normalizes bounded public Crew IDs and rejects unsafe identifiers", () => {
  assert.equal(maximumTeamCoupleCrewIdLength, 64);
  assert.equal(normalizeTeamCoupleCrewId("  bd-crew_01  "), "BD-CREW_01");
  assert.equal(normalizeTeamCoupleCrewId("A".repeat(64)), "A".repeat(64));

  for (const value of [
    "",
    "   ",
    "crew id",
    "crew@example.com",
    "../crew",
    "A".repeat(65),
    null,
    42,
  ]) {
    assert.equal(normalizeTeamCoupleCrewId(value), "");
  }

  assert.equal(isTeamCoupleRelationshipId(relationshipId), true);
  assert.equal(isTeamCoupleRelationshipId("not-a-relationship"), false);
  assert.equal(isTeamCoupleVersion(1), true);
  assert.equal(isTeamCoupleVersion(2_147_483_647), true);
  assert.equal(isTeamCoupleVersion(2_147_483_648), false);
  assert.equal(isTeamCoupleVersion(0), false);
  assert.equal(isTeamCoupleVersion(1.5), false);
  assert.equal(isTeamCoupleVersion("1"), false);
});

test("parses and normalizes the complete Team/Couple dashboard contract", () => {
  const parsed = parseTeamCoupleDashboard([
    dashboard({ ownCrewId: " bd-owner_01 " }),
  ]);

  assert.deepEqual(parsed, {
    ownCrewId: "BD-OWNER_01",
    members: [person()],
    incomingInvites: [
      {
        ...invitation({
          relationshipId: secondRelationshipId,
          publicCrewId: "BD-CAPTAIN_02",
          fullName: "Grace Hopper",
          currentPosition: "Captain",
          accountRole: "captain",
        }),
        invitedAt: "2026-08-11T05:30:00.000Z",
      },
    ],
    outgoingInvites: [],
  });
});

test("fails malformed Team/Couple payloads closed", () => {
  const invalidPayloads = [
    null,
    [],
    [dashboard(), dashboard()],
    dashboard({ ownCrewId: "not a crew id" }),
    dashboard({ members: null }),
    dashboard({ members: [person({ relationshipId: "bad-id" })] }),
    dashboard({ members: [person({ publicCrewId: "bad id" })] }),
    dashboard({ members: [person({ fullName: "" })] }),
    dashboard({ members: [person({ fullName: "N".repeat(121) })] }),
    dashboard({ members: [person({ version: 0 })] }),
    dashboard({ members: [person({ version: "1" })] }),
    dashboard({ members: [person({ isAvailable: "false" })] }),
    dashboard({ members: [person({ accountRole: "owner" })] }),
    dashboard({ incomingInvites: [invitation({ invitedAt: "not-a-date" })] }),
    dashboard({ outgoingInvites: [{}] }),
  ];

  for (const payload of invalidPayloads) {
    assert.equal(parseTeamCoupleDashboard(payload), null);
  }

  assert.equal(
    parseTeamCoupleDashboard(
      dashboard({ members: [person({ currentPosition: "R".repeat(121) })] }),
    )?.members[0]?.currentPosition,
    "",
  );
});

test("parses unavailable tombstones and counts Unicode code points", () => {
  const unicodeName = "🛟".repeat(120);
  const parsed = parseTeamCoupleDashboard(
    dashboard({
      members: [
        person({
          fullName: unicodeName,
          currentPosition: "",
        }),
        person({
          relationshipId: secondRelationshipId,
          publicCrewId: "UNAVAILABLE",
          fullName: "Unavailable crew",
          currentPosition: "",
          isAvailable: false,
          version: 7,
        }),
      ],
    }),
  );

  assert.equal(parsed?.members[0]?.fullName, unicodeName);
  assert.deepEqual(parsed?.members[1], {
    relationshipId: secondRelationshipId,
    version: 7,
    publicCrewId: "UNAVAILABLE",
    fullName: "Unavailable crew",
    currentPosition: "",
    accountRole: "crew",
    isAvailable: false,
  });
  assert.equal(
    parseTeamCoupleDashboard(
      dashboard({ members: [person({ fullName: "🛟".repeat(121) })] }),
    ),
    null,
  );
});

test("bounds every Team/Couple collection before hydrating it", () => {
  const fiftyMembers = Array.from({ length: 50 }, () => person());
  const fiftyInvites = Array.from({ length: 50 }, () => invitation());

  assert.equal(
    parseTeamCoupleDashboard(
      dashboard({
        members: fiftyMembers,
        incomingInvites: fiftyInvites,
        outgoingInvites: fiftyInvites,
      }),
    )?.members.length,
    50,
  );
  assert.equal(
    parseTeamCoupleDashboard(
      dashboard({ members: [...fiftyMembers, person()] }),
    ),
    null,
  );
  assert.equal(
    parseTeamCoupleDashboard(
      dashboard({ incomingInvites: [...fiftyInvites, invitation()] }),
    ),
    null,
  );
  assert.equal(
    parseTeamCoupleDashboard(
      dashboard({ outgoingInvites: [...fiftyInvites, invitation()] }),
    ),
    null,
  );
});

test("Team/Couple API keeps authentication, body, rate and response boundaries", async () => {
  const route = await source("app/api/team-couple/route.ts");

  assert.match(route, /authenticatedEmployerClients\(request\)/);
  assert.match(route, /getClientIp\(request\)/);
  assert.match(route, /team-couple:\$\{method\}:ip:/);
  assert.match(route, /team-couple:\$\{method\}:user:/);
  assert.match(route, /const maximumRequestBytes = 8_192/);
  assert.match(
    route,
    /readLimitedJsonObjectDetailed\([\s\S]*?maximumRequestBytes/,
  );
  assert.match(route, /Object\.keys\(parsed\.body\)\.some/);
  assert.match(route, /key !== "crewId"/);
  assert.match(route, /key !== "expectedVersion"/);
  assert.match(route, /parsed\.body\.action !== "accept"/);
  assert.match(route, /removeActions = new Set<TeamCoupleRemoveAction>/);
  assert.match(route, /"cancel",\s*"decline",\s*"remove"/);
  assert.match(route, /isTeamCoupleRelationshipId\(parsed\.body\.relationshipId\)/);
  assert.match(route, /isTeamCoupleVersion\(parsed\.body\.expectedVersion\)/);
  assert.match(route, /"bluedeck_team_couple_dashboard"/);
  assert.match(route, /"bluedeck_invite_team_couple"/);
  assert.match(route, /"bluedeck_respond_team_couple"/);
  assert.match(route, /"bluedeck_remove_team_couple"/);
  assert.match(route, /p_actor_user_id: authorized\.userId/);
  assert.match(route, /p_recipient_public_crew_id: crewId/);
  assert.match(route, /p_expected_version: parsed\.body\.expectedVersion/);
  assert.match(route, /p_action: parsed\.body\.action/);
  assert.match(route, /code: "RATE_LIMITED"/);
  assert.match(route, /code: "INVALID_CREW_ID"/);
  assert.match(route, /"RELATIONSHIP_STALE"/);
  assert.match(
    route,
    /"Cache-Control", "private, no-store, max-age=0, must-revalidate"/,
  );
  assert.match(route, /headers\.set\("Vary", "Authorization"\)/);
  assert.match(route, /headers\.set\("X-Content-Type-Options", "nosniff"\)/);
  assert.match(route, /"Retry-After"/);
});

test("dashboard places an accessible Team/Couple manager beside Role", async () => {
  const [page, panel] = await Promise.all([
    source("app/dashboard/page.tsx"),
    source("app/dashboard/TeamCouplePanel.tsx"),
  ]);

  assert.match(
    page,
    /<div className="mt-3 flex flex-wrap items-center gap-2">[\s\S]*?dashboard\.role[\s\S]*?hasCrewWorkspace \? <TeamCouplePanel \/>/,
  );
  assert.match(panel, /aria-haspopup="dialog"/);
  assert.match(panel, /<dialog/);
  assert.match(panel, /dialog\.showModal\(\)/);
  assert.match(panel, /onCancel=\{\(event\) => \{/);
  assert.match(panel, /event\.preventDefault\(\)/);
  assert.match(panel, /event\.target === event\.currentTarget/);
  assert.match(panel, /triggerRef\.current\?\.focus\(\)/);
  assert.match(panel, /aria-labelledby=\{dialogTitleId\}/);
  assert.match(panel, /aria-describedby=\{dialogDescriptionId\}/);
  assert.match(panel, /fetch\("\/api\/team-couple"/);
  assert.match(panel, /method: MutationMethod/);
  assert.match(panel, /action: "accept" \| "decline"/);
  assert.match(panel, /expectedVersion: invitation\.version/);
  assert.match(panel, /action: pendingInvite \? "cancel" : "remove"/);
  assert.match(panel, /action: "decline"/);
  assert.match(panel, /invitation\.isAvailable/);
  assert.match(panel, /copyText\.unavailablePerson/);
  assert.match(panel, /copyText\.incomingInviteCount\(incomingCount\)/);
  assert.match(panel, /aria-hidden/);
  assert.match(panel, /if \(refreshed\)/);
  assert.match(panel, /reconciled\(dashboardRef\.current\)/);
  assert.match(panel, /localizedError\(cause, copyText/);
  assert.match(panel, /copyByLanguage = \{[\s\S]*?en: \{[\s\S]*?tr: \{/);
  assert.match(panel, /dashboard\.incomingInvites\.map/);
  assert.match(panel, /dashboard\.members\.map/);
  assert.match(panel, /dashboard\.outgoingInvites\.map/);
  assert.doesNotMatch(panel, /applicant_user_id|requester_user_id|recipient_user_id/);
});
