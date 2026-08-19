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
    cvMarkup,
    /className="bd-cv-experience-grid grid grid-cols-\[136px_1fr\] items-stretch"/,
  );
  assert.match(cvMarkup, /className="grid grid-cols-2 gap-3"/);
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
