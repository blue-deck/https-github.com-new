import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public crew CV keeps the desktop composition at every screen width", async () => {
  const page = await source("app/crew/[crewId]/page.tsx");
  const cvMarkup = page.slice(
    page.indexOf("<CvScaleFrame>"),
    page.indexOf("</CvScaleFrame>") + "</CvScaleFrame>".length,
  );

  assert.match(cvMarkup, /<CvScaleFrame>/);
  assert.doesNotMatch(cvMarkup, /responsiveOnMobile|\b(?:sm|md|lg|xl|2xl):/);
  assert.match(cvMarkup, /w-\[980px\]/);
  assert.match(cvMarkup, /grid-cols-\[320px_1fr\]/);
  assert.match(cvMarkup, /className="bd-cv-main p-8 print:p-7"/);
  assert.match(
    page,
    /className="bd-cv-experience-grid grid grid-cols-\[136px_1fr\] items-stretch"/,
  );
  assert.match(cvMarkup, /className="grid grid-cols-2 gap-3"/);
});

test("public crew CV separates yacht and other experience without exposing internal markers", async () => {
  const page = await source("app/crew/[crewId]/page.tsx");
  const experienceLoader = page.slice(
    page.indexOf("async function loadPublicCvExperienceRows"),
    page.indexOf("function primaryPosition"),
  );

  assert.match(page, /title="Yacht Experience"/);
  assert.match(page, /title="Other Experience"/);
  assert.match(page, /experience_kind: isOtherWork \? "other" : "yacht"/);
  assert.match(page, /yacht_type: isOtherWork\s*\? ""/);
  assert.match(page, /yacht_program: isOtherWork\s*\? ""/);
  assert.doesNotMatch(
    page.slice(page.indexOf("function PublicExperienceSection")),
    /otherWorkExperienceMarker/,
  );
  assert.match(experienceLoader, /while \(rows\.length < maximumPublicCvExperienceRows\)/);
  assert.match(experienceLoader, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(experienceLoader, /\.range\(offset, offset \+ requestedPageSize - 1\)/);
  assert.doesNotMatch(experienceLoader, /\.limit\(30\)/);
  assert.match(page, /maximumRenderedPublicExperiencesPerType = 30/);
});

test("profile snapshots report yacht and other experience independently", async () => {
  const profile = await source("app/profile/page.tsx");

  assert.match(
    profile,
    /<Snapshot label="Yacht Experience" value=\{yachtExperienceDuration\} tone="cyan" \/>/,
  );
  assert.match(
    profile,
    /<Snapshot label="Other Experience" value=\{otherExperienceDuration\} tone="gold" \/>/,
  );
  assert.doesNotMatch(profile, /<Snapshot label="Documents"/);
});

test("fixed CV frames scale the 980px design instead of reflowing it", async () => {
  const frame = await source("app/components/CvScaleFrame.tsx");
  const styles = await source("app/globals.css");

  assert.match(
    frame,
    /const nextScale = Math\.min\(1, availableWidth \/ cvDesignWidth\);/,
  );
  assert.doesNotMatch(frame, /Math\.max\(0\.24/);
  assert.match(
    styles,
    /\.bd-cv-scale-wrap:not\(\.bd-cv-scale-wrap-mobile-readable\) \.bd-cv-layout \{[\s\S]*?grid-template-columns: 320px 1fr !important;/,
  );
  assert.match(
    styles,
    /\.bd-cv-scale-wrap:not\(\.bd-cv-scale-wrap-mobile-readable\) \.bd-cv-experience-grid \{[\s\S]*?grid-template-columns: 136px 1fr !important;/,
  );
});

test("profile preview and short PDFs preserve the complete CV", async () => {
  const profile = await source("app/profile/page.tsx");

  assert.match(profile, /className="bd-cv-main p-8 print:p-7"/);
  assert.match(
    profile,
    /if \(documents\.length > 0 && pages\.length === 1\) \{\s*pages\.push\(\{ kind: "continued", experiences: \[\] \}\);\s*\}/,
  );
  assert.match(profile, /\) : page\.experiences\.length > 0 \? \(/);
});
