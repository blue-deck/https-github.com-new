import assert from "node:assert/strict";
import test from "node:test";
import { getHomeAudienceNavigation } from "../app/lib/homeAudienceNavigation.ts";
import { safeInternalPath } from "../app/lib/site.ts";

function destination(href) {
  return new URL(href, "https://bluedeck.test");
}

test("signed-out crew CTA requests login and preserves the CV Studio destination", () => {
  const { crewProfileHref } = getHomeAudienceNavigation({ kind: "signed-out" });
  const url = destination(crewProfileHref);

  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("mode"), null);
  assert.equal(url.searchParams.get("next"), "/profile#cv-studio");
  assert.equal(safeInternalPath(url.searchParams.get("next")), "/profile#cv-studio");
  assert.equal(url.hash, "", "the CV section belongs to the return URL, not the login page");
});

test("signed-out hiring CTA opens Create Account without selecting an account role", () => {
  const { hiringHref } = getHomeAudienceNavigation({ kind: "signed-out" });
  const url = destination(hiringHref);

  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("mode"), "signup");
  assert.equal(url.searchParams.get("next"), "/hiring");
  assert.equal(url.searchParams.get("role"), null);
});

test("signed-in crew and captains go directly to the My Profile CV Studio", () => {
  for (const role of ["crew", "captain"]) {
    const { crewProfileHref } = getHomeAudienceNavigation({ kind: "signed-in", role });
    assert.equal(crewProfileHref, "/profile#cv-studio", role);
  }
});

test("signed-in posting roles open My Job Postings & Hiring, not a new-post editor", () => {
  for (const role of ["captain", "owner", "management"]) {
    const { hiringHref } = getHomeAudienceNavigation({ kind: "signed-in", role });
    assert.equal(hiringHref, "/hiring", role);
  }
});

test("crew and unresolved roles use the guarded hiring workspace without changing account role", () => {
  for (const role of ["crew", null]) {
    const viewer = Object.freeze({ kind: "signed-in", role });
    const { hiringHref } = getHomeAudienceNavigation(viewer);
    const url = destination(hiringHref);

    assert.equal(url.pathname, "/hiring");
    assert.equal(url.search, "");
    assert.equal(viewer.role, role);
  }
});

test("a restoring session preserves both destinations through the auth page", () => {
  const navigation = getHomeAudienceNavigation({ kind: "loading" });

  assert.equal(destination(navigation.crewProfileHref).searchParams.get("next"), "/profile#cv-studio");
  assert.equal(destination(navigation.hiringHref).searchParams.get("next"), "/hiring");
  assert.equal(destination(navigation.hiringHref).searchParams.get("mode"), "signup");
});
