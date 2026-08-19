import assert from "node:assert/strict";
import test from "node:test";
import {
  countExperienceReferences,
  referenceMatchesExperience,
  referencesForExperience,
  unlinkedExperienceReferences,
} from "../app/lib/crewExperienceReferences.ts";

const yachtExperienceId = "00000000-0000-4000-8000-000000000001";
const secondYachtExperienceId = "00000000-0000-4000-8000-000000000002";
const otherWorkExperienceId = "00000000-0000-4000-8000-000000000003";
const secondOtherWorkExperienceId = "00000000-0000-4000-8000-000000000004";
const orphanExperienceId = "00000000-0000-4000-8000-000000000099";

test("isolates references between yacht experiences with the same name", () => {
  const firstExperience = { id: yachtExperienceId, yacht_name: "Aurora" };
  const secondExperience = {
    id: secondYachtExperienceId,
    yacht_name: "Aurora",
  };
  const reference = {
    id: "reference-one",
    crew_experience_id: yachtExperienceId,
    vessel: "Aurora",
  };

  assert.deepEqual(referencesForExperience(firstExperience, [reference]), [
    reference,
  ]);
  assert.deepEqual(referencesForExperience(secondExperience, [reference]), []);
  assert.equal(
    countExperienceReferences(
      [firstExperience, secondExperience],
      [reference],
    ),
    1,
  );
});

test("does not use yacht-name substring matches", () => {
  const aurora = { id: yachtExperienceId, yacht_name: "Aurora" };
  const auroraTwo = {
    id: secondYachtExperienceId,
    yacht_name: "Aurora II",
  };
  const reference = {
    crew_experience_id: secondYachtExperienceId,
    vessel: "Aurora",
  };

  assert.equal(referenceMatchesExperience(reference, aurora), false);
  assert.equal(referenceMatchesExperience(reference, auroraTwo), true);
});

test("uses the same ID-only isolation for Other Work Experience", () => {
  const firstExperience = {
    id: otherWorkExperienceId,
    yacht_name: "Blue Marine",
    yacht_type: "__BLUDECK_OTHER_WORK__",
  };
  const secondExperience = {
    id: secondOtherWorkExperienceId,
    yacht_name: "Blue Marine",
    yacht_type: "__BLUDECK_OTHER_WORK__",
  };
  const reference = {
    crew_experience_id: secondOtherWorkExperienceId,
    vessel: "Blue Marine",
  };

  assert.deepEqual(referencesForExperience(firstExperience, [reference]), []);
  assert.deepEqual(referencesForExperience(secondExperience, [reference]), [
    reference,
  ]);
});

test("keeps a reference linked when its experience is renamed", () => {
  const reference = {
    crew_experience_id: yachtExperienceId,
    vessel: "Old yacht name",
  };
  const beforeRename = {
    id: yachtExperienceId,
    yacht_name: "Old yacht name",
  };
  const afterRename = {
    id: yachtExperienceId,
    yacht_name: "New yacht name",
  };
  const unrelatedSameName = {
    id: secondYachtExperienceId,
    yacht_name: "New yacht name",
  };

  assert.equal(referenceMatchesExperience(reference, beforeRename), true);
  assert.equal(referenceMatchesExperience(reference, afterRename), true);
  assert.equal(referenceMatchesExperience(reference, unrelatedSameName), false);
});

test("ignores null, malformed, and orphan reference links", () => {
  const experience = { id: yachtExperienceId, yacht_name: "Aurora" };
  const linked = { crew_experience_id: yachtExperienceId };
  const nullLink = { crew_experience_id: null };
  const missingLink = {};
  const malformedLink = { crew_experience_id: "Aurora" };
  const orphanLink = { crew_experience_id: orphanExperienceId };
  const references = [
    linked,
    nullLink,
    missingLink,
    malformedLink,
    orphanLink,
  ];

  assert.equal(countExperienceReferences([experience], references), 1);
  assert.deepEqual(referencesForExperience(experience, references), [linked]);
  assert.deepEqual(unlinkedExperienceReferences([experience], references), [
    nullLink,
    missingLink,
    malformedLink,
    orphanLink,
  ]);
  assert.deepEqual(referencesForExperience({}, references), []);
});
