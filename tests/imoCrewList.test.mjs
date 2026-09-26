import assert from "node:assert/strict";
import test from "node:test";
import {
  IMO_CREW_LIST_MAX_FIELD_LENGTH,
  IMO_CREW_LIST_MAX_FILE_BYTES,
  IMO_CREW_LIST_MAX_ROWS,
  createEmptyImoCrewRow,
  createImoCrewListDraft,
  getImoCrewListFilename,
  getImoCrewListIssues,
  parseImoCrewListDraft,
  serializeImoCrewListDraft,
} from "../app/lib/imoCrewList.ts";

const yachtId = "yacht-01";

function member(overrides = {}) {
  return {
    status: "active",
    position: "Captain",
    crew_profiles: {
      full_name: "Ada Mary Lovelace",
      current_position: "First Officer",
      nationality: "United Kingdom",
      date_of_birth: "1990-12-10",
      gender: "Female",
      passport_number: "123456789",
      passport_expiry: "2032-01-31",
    },
    ...overrides,
  };
}

function completeDraft() {
  const draft = createImoCrewListDraft(
    yachtId,
    { name: "M/Y Blue Sea", flag: "Malta" },
    [member()],
  );
  Object.assign(draft.voyage, {
    portOfArrivalDeparture: "Valletta",
    arrivalDepartureDate: "2027-04-20",
    lastPort: "Athens",
    declarationDate: "2027-04-20",
  });
  Object.assign(draft.crew[0], {
    placeOfBirth: "London",
    issuingState: "United Kingdom",
  });
  return draft;
}

test("starts from the active authorized roster in source order and keeps absent legal fields blank", () => {
  const draft = createImoCrewListDraft(
    yachtId,
    { name: "Blue Sea", flag: "Malta" },
    [
      member({ status: "pending" }),
      member({ position: "Chief Officer" }),
      member({ status: "inactive" }),
      member({ status: "left" }),
      member({ crew_profiles: { full_name: "Grace Hopper", current_position: "Captain" }, position: "" }),
      null,
    ],
  );
  assert.equal(draft.version, 1);
  assert.equal(draft.yachtId, yachtId);
  assert.equal(draft.voyage.shipName, "Blue Sea");
  assert.equal(draft.voyage.flagState, "Malta");
  assert.equal(draft.voyage.masterName, "Grace Hopper");
  assert.equal(draft.voyage.arrivalDepartureDate, "");
  assert.deepEqual(draft.crew.map((row) => [row.givenNames, row.familyName, row.rank]), [
    ["Ada Mary", "Lovelace", "Chief Officer"],
    ["Grace", "Hopper", "Captain"],
  ]);
  assert.equal(draft.crew[0].documentType, "Passport");
  assert.equal(draft.crew[0].documentNumber, "123456789");
  assert.equal(draft.crew[0].documentExpiry, "2032-01-31");
  assert.equal(draft.crew[0].dateOfBirth, "1990-12-10");
  assert.equal(draft.crew[0].gender, "Female");
  assert.equal(draft.crew[0].placeOfBirth, "");
  assert.equal(draft.crew[0].issuingState, "");
  assert.equal(draft.crew[1].documentType, "");
  assert.notEqual(draft.crew[0].id, draft.crew[1].id);
});

test("never fills a legal name from an invitation, email, or malformed profile", () => {
  const draft = createImoCrewListDraft(yachtId, null, [
    member({ invited_email: "captain@example.com", crew_profiles: { email: "captain@example.com" } }),
    member({ crew_profiles: { full_name: "captain@example.com" } }),
    member({ crew_profiles: null }),
    member({ crew_profiles: { full_name: "Sinan", date_of_birth: "2000-02-30", passport_expiry: "n/a" } }),
  ]);
  for (const row of draft.crew.slice(0, 3)) {
    assert.equal(row.familyName, "");
    assert.equal(row.givenNames, "");
  }
  assert.equal(draft.crew[3].familyName, "Sinan");
  assert.equal(draft.crew[3].givenNames, "");
  assert.equal(draft.crew[3].dateOfBirth, "");
  assert.equal(draft.crew[3].documentExpiry, "");
});

test("recognizes active status despite surrounding whitespace or letter case", () => {
  const draft = createImoCrewListDraft(yachtId, {}, [
    member({ status: " ACTIVE " }),
    member({ status: "Active", crew_profiles: { full_name: "Grace Hopper" } }),
    member({ status: " Inactive " }),
    member({ status: true }),
    member({ status: null }),
  ]);
  assert.deepEqual(draft.crew.map((row) => row.familyName), ["Lovelace", "Hopper"]);
});

test("round-trips drafts without extra API fields and does not mutate the draft during advice", () => {
  const draft = completeDraft();
  const serialized = serializeImoCrewListDraft(draft);
  const restored = parseImoCrewListDraft(serialized, yachtId);
  assert.deepEqual(restored, draft);
  assert.doesNotMatch(serialized, /crew_profiles|invited_email|user_id/);
  assert.deepEqual(getImoCrewListIssues(draft), []);
  assert.equal(serializeImoCrewListDraft(draft), serialized);
});

test("rejects malformed, unsupported, and wrong-yacht imports", () => {
  const draft = completeDraft();
  for (const input of [
    "not json", "null", "[]",
    JSON.stringify({ ...draft, version: 2 }),
    JSON.stringify({ ...draft, yachtId: "another-yacht" }),
    JSON.stringify({ ...draft, yachtId: "" }),
    JSON.stringify({ ...draft, voyage: null }),
    JSON.stringify({ ...draft, voyage: { ...draft.voyage, movement: "both" } }),
    JSON.stringify({ ...draft, crew: {} }),
    JSON.stringify({ ...draft, crew: [null] }),
    JSON.stringify({ ...draft, crew: [{ ...draft.crew[0], familyName: 42 }] }),
    JSON.stringify({ ...draft, crew: [{ ...draft.crew[0], rank: undefined }] }),
  ]) {
    assert.throws(() => parseImoCrewListDraft(input, yachtId));
  }
});

test("bounds row counts and text in Unicode code points without silently dropping crew", () => {
  const draft = completeDraft();
  draft.crew = Array.from({ length: IMO_CREW_LIST_MAX_ROWS }, () => createEmptyImoCrewRow());
  draft.crew[0].givenNames = "🛟".repeat(IMO_CREW_LIST_MAX_FIELD_LENGTH);
  assert.equal(parseImoCrewListDraft(JSON.stringify(draft), yachtId).crew.length, 200);
  draft.crew[0].givenNames += "a";
  assert.throws(() => parseImoCrewListDraft(JSON.stringify(draft), yachtId));
  draft.crew[0].givenNames = "";
  draft.crew.push(createEmptyImoCrewRow());
  assert.throws(() => parseImoCrewListDraft(JSON.stringify(draft), yachtId));
  assert.throws(() => createImoCrewListDraft(yachtId, {}, Array.from({ length: 201 }, () => member())));
});

test("rejects oversized UTF-8 files before hydration", () => {
  const draft = completeDraft();
  const input = JSON.stringify({ ...draft, extra: "ü".repeat(IMO_CREW_LIST_MAX_FILE_BYTES / 2) });
  assert.ok(input.length < IMO_CREW_LIST_MAX_FILE_BYTES);
  assert.ok(new TextEncoder().encode(input).byteLength > IMO_CREW_LIST_MAX_FILE_BYTES);
  assert.throws(() => parseImoCrewListDraft(input, yachtId), /too large/);
});

test("requires real ISO dates and disallows hidden control characters on import", () => {
  const draft = completeDraft();
  for (const date of ["2027-02-29", "2024-04-31", "0000-01-01", "01/02/2027", "2027-04-20T00:00:00Z"]) {
    const altered = { ...draft, voyage: { ...draft.voyage, arrivalDepartureDate: date } };
    assert.throws(() => parseImoCrewListDraft(JSON.stringify(altered), yachtId), /date/);
  }
  draft.voyage.arrivalDepartureDate = "2028-02-29";
  assert.equal(parseImoCrewListDraft(JSON.stringify(draft), yachtId).voyage.arrivalDepartureDate, "2028-02-29");
  for (const unsafe of ["ID\u0000123", "ID\n123", "ID\u202e123"]) {
    draft.crew[0].documentNumber = unsafe;
    assert.throws(() => parseImoCrewListDraft(JSON.stringify(draft), yachtId), /documentNumber/);
  }
});

test("imports only allowlisted properties and restores safe unique row identifiers", () => {
  const draft = completeDraft();
  draft.crew.push({ ...draft.crew[0] }, { ...draft.crew[0], id: "../../path" });
  const input = JSON.parse(JSON.stringify(draft));
  input.__proto__ = { injected: true };
  Object.defineProperty(input, "__proto__", { enumerable: true, value: { injected: true } });
  input.voyage.unauthorized = "ignored";
  input.crew[0].profile = { email: "private@example.com" };
  const imported = parseImoCrewListDraft(JSON.stringify(input), yachtId);
  assert.equal(Object.hasOwn(imported, "__proto__"), false);
  assert.equal(imported.injected, undefined);
  assert.equal(Object.hasOwn(imported.voyage, "unauthorized"), false);
  assert.equal(Object.hasOwn(imported.crew[0], "profile"), false);
  assert.equal(imported.crew[0].id, draft.crew[0].id);
  assert.equal(new Set(imported.crew.map((row) => row.id)).size, 3);
  assert.ok(imported.crew.every((row) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(row.id)));
});

test("advises on missing data, IMO checksum, birth dates and expiry at the voyage date", () => {
  const draft = completeDraft();
  draft.voyage.imoNumber = "IMO 9074729";
  assert.deepEqual(getImoCrewListIssues(draft), []);
  draft.voyage.imoNumber = "9074720";
  draft.crew[0].documentExpiry = "2027-04-19";
  draft.crew[0].dateOfBirth = "2027-04-21";
  draft.crew[0].issuingState = "";
  assert.deepEqual(getImoCrewListIssues(draft), [
    { field: "imoNumber", kind: "invalid" },
    { field: "issuingState", rowId: draft.crew[0].id, kind: "missing" },
    { field: "dateOfBirth", rowId: draft.crew[0].id, kind: "invalid" },
    { field: "documentExpiry", rowId: draft.crew[0].id, kind: "expired" },
  ]);
  draft.crew[0].documentExpiry = "2027-04-20";
  assert.ok(!getImoCrewListIssues(draft).some((issue) => issue.kind === "expired"));
  draft.crew = [];
  assert.ok(getImoCrewListIssues(draft).some((issue) => issue.field === "crew" && issue.kind === "missing"));
});

test("creates bounded download filenames without path separators or sensitive crew data", () => {
  const draft = completeDraft();
  draft.voyage.shipName = "../../ M/Y Ége Işığı ";
  assert.equal(getImoCrewListFilename(draft, "pdf"), "imo-crew-list-m-y-ege-isigi-arrival-2027-04-20.pdf");
  draft.voyage.shipName = "船";
  draft.voyage.arrivalDepartureDate = "";
  draft.voyage.movement = "departure";
  assert.equal(getImoCrewListFilename(draft, "json"), "imo-crew-list-yacht-departure-undated.json");
});
