import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

async function cardSources() {
  const [presentation, styles] = await Promise.all([
    source("app/components/CrewCandidatePresentation.tsx"),
    source("app/components/CrewCandidateCard.module.css"),
  ]);
  const card = presentation.slice(
    presentation.indexOf("export function CrewCandidatePassportCard"),
    presentation.indexOf("export function CrewCandidateProfileIdentity"),
  );
  const variantStart = card.indexOf('if (layout === "navy-ticket")');
  assert.notEqual(variantStart, -1, "the navy layout must be an explicit opt-in");

  // The scoped variant's JSX expressions have balanced braces. Keeping this
  // extraction local avoids accidentally satisfying assertions with legacy JSX.
  let depth = 0;
  let variantEnd = -1;
  const bodyStart = card.indexOf("{", variantStart);
  for (let index = bodyStart; index < card.length; index += 1) {
    if (card[index] === "{") depth += 1;
    if (card[index] === "}") depth -= 1;
    if (depth === 0) {
      variantEnd = index + 1;
      break;
    }
  }
  assert.notEqual(variantEnd, -1, "the navy layout must have a complete body");
  return { presentation, card, styles, navy: card.slice(variantStart, variantEnd) };
}

function cssRule(styles, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(rule, `missing scoped CSS rule: ${selector}`);
  return rule[1];
}

test("Find Crew explicitly opts into the navy card without changing hiring cards", async () => {
  const [{ card, presentation }, findCrew, hiring] = await Promise.all([
    cardSources(),
    source("app/find-crew/FindCrewClient.tsx"),
    source("app/hiring/jobs/[id]/applications/JobApplicationsManager.tsx"),
  ]);

  assert.match(card, /layout\s*=\s*"passport"/);
  assert.match(card, /layout\?:\s*"passport"\s*\|\s*"navy-ticket"/);
  assert.match(presentation, /import .+ from "\.\/CrewCandidateCard\.module\.css"/);
  assert.match(findCrew, /<CrewCandidatePassportCard[\s\S]*?layout="navy-ticket"/);
  assert.doesNotMatch(hiring, /layout="navy-ticket"/);
  assert.match(hiring, /<CrewCandidatePassportCard/);
});

test("navy crew cards retain masked identity with an accessible premium icon", async () => {
  const [{ navy }, data] = await Promise.all([
    cardSources(),
    source("app/lib/findCrewData.ts"),
  ]);

  assert.match(navy, /data-crew-card-layout=\{layout\}/);
  assert.match(navy, /aria-labelledby=\{titleId\}/);
  assert.match(navy, /<CandidateAvatar/);
  assert.match(navy, /profilePhotoUrl=\{candidate\.profilePhotoUrl\}/);
  assert.match(navy, /\{candidate\.displayName\}/);
  assert.match(navy, /\{copy\.nameLocked\}/);
  assert.match(navy, /candidate\.currentPosition \|\| copy\.crewMember/);
  assert.doesNotMatch(navy, /\{primaryBadge\}/);
  assert.match(navy, /candidate\.premiumProfile/);
  assert.match(navy, /<BadgeCheck aria-hidden/);
  assert.match(navy, /title=\{copy\.premium\}/);
  assert.match(navy, /<span className="sr-only">\{copy\.premium\}<\/span>/);
  assert.match(data, /displayName: maskedPersonName\(rawName\)/);
  assert.doesNotMatch(navy, /candidate\.(?:email|phone|fullName|full_name)/);
});

test("navy facts preserve existing labels, fallbacks and experience formatting", async () => {
  const { navy } = await cardSources();

  assert.match(navy, /<dl\b/);
  assert.equal((navy.match(/<NavyTicketFact\b/g) || []).length, 3);
  assert.match(navy, /label=\{copy\.nationality\}/);
  assert.match(navy, /candidate\.nationality \|\| copy\.notProvided/);
  assert.match(navy, /label=\{copy\.availableToStart\}/);
  assert.match(navy, /availabilityValue \|\| copy\.notProvided/);
  assert.match(navy, /label=\{copy\.experience\}/);
  assert.match(navy, /candidateExperienceValue\(\s*candidate,\s*experienceLanguage,/);
  assert.match(navy, /profileExperienceLabel\(\s*candidate\.experienceYears,/);
  assert.doesNotMatch(navy, /fourthFact/);
});

test("navy crew cards keep one profile destination and accessible action copy", async () => {
  const [{ navy, card }, findCrew] = await Promise.all([
    cardSources(),
    source("app/find-crew/FindCrewClient.tsx"),
  ]);

  assert.equal((navy.match(/<Link\b/g) || []).length, 1);
  assert.match(navy, /href=\{profileHref\}/);
  assert.match(navy, /aria-label=\{actionLabel\}/);
  assert.match(navy, /\{actionContent\}/);
  assert.match(card, /const actionLabel = `\$\{copy\.viewProfile\}: \$\{candidate\.displayName\}`/);
  assert.match(card, /const actionContent = \([\s\S]*?\{copy\.viewProfile\}/);
  assert.match(findCrew, /profileHref=\{`\/find-crew\/\$\{encodeURIComponent\(profile\.crewId\)\}`\}/);
  assert.doesNotMatch(navy, /Sign up|Invite crew|Apply now/);
});

test("directory cards use the ice-blue surface with a distinct blue profile action", async () => {
  const [{ styles }, jobStyles] = await Promise.all([
    cardSources(),
    source("app/jobs/PublicJobListingCard.module.css"),
  ]);
  const outer = cssRule(styles, ".card");
  const header = cssRule(styles, ".header");
  const facts = cssRule(styles, ".facts");

  assert.match(outer, /overflow:\s*hidden/);
  assert.match(outer, /border-radius:/);
  for (const token of ["navy"]) {
    const pattern = new RegExp(`--card-${token}:\\s*([^;]+)`);
    const crewToken = outer.match(pattern);
    const jobToken = jobStyles.match(pattern);
    assert.ok(crewToken, `crew card needs the shared ${token} color`);
    assert.ok(jobToken, `job card needs the shared ${token} color`);
    assert.equal(crewToken[1], jobToken[1], `${token} must match the existing job card`);
  }
  assert.match(outer, /background(?:-color)?:\s*var\(--card-surface\)/);
  assert.match(outer, /color:\s*var\(--card-navy\)/);
  assert.match(facts, /background(?:-color)?:\s*var\(--card-facts\)/);
  assert.match(cssRule(styles, ".action"), /background(?:-color)?:\s*var\(--card-blue\)/);
  assert.match(cssRule(styles, ".action"), /color:\s*#fff/);
  assert.doesNotMatch(header, /border-radius|box-shadow|margin(?:-bottom)?:/);
  assert.match(facts, /border-radius:/);
  assert.doesNotMatch(facts, /box-shadow/);
  assert.match(facts, /margin:\s*0;/);
  assert.doesNotMatch(styles, /(?:linear|radial|conic)-gradient/);
});

test("crew identity and three facts align horizontally when the card has room", async () => {
  const { styles } = await cardSources();
  const outer = cssRule(styles, ".card");
  const facts = cssRule(styles, ".facts");

  assert.match(outer, /container-type:\s*inline-size/);
  assert.match(facts, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@container \(min-width: 680px\)[\s\S]*?\.content\s*\{[^}]*grid-template-columns:[^;]+max-content/);
  assert.match(styles, /@container \(min-width: 960px\)[\s\S]*?\.content\s*\{[^}]*grid-template-columns:[^;]+max-content/);
  assert.doesNotMatch(styles, /grid-column:\s*1\s*\/\s*-1/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
});
