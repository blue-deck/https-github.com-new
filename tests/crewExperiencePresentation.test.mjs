import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const presentationSource = await readFile(
  new URL("../app/components/CrewCandidatePresentation.tsx", import.meta.url),
  "utf8",
);

test("crew cards separate yacht and other experience labels with a colon", () => {
  assert.match(
    presentationSource,
    /\$\{labels\.yacht\}: \$\{formatCrewExperienceDuration/,
  );
  assert.match(
    presentationSource,
    /\$\{labels\.other\}: \$\{formatCrewExperienceDuration/,
  );
  assert.doesNotMatch(
    presentationSource,
    /\$\{labels\.(?:yacht|other)\} — /,
  );
});
