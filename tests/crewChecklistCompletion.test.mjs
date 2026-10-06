import assert from "node:assert/strict";
import test from "node:test";
import { saveCrewChecklistCompletion } from "../app/lib/crewChecklistCompletion.ts";

const checklistId = "00000000-0000-4000-8000-000000000001";
const serverTime = "2026-10-06T09:30:00+00:00";
const serverUpdatedTime = "2026-10-06T09:30:01+00:00";
const schemaError = {
  code: "PGRST204",
  message: "Could not find the 'completed_at' column in the schema cache",
};

function mockClient(...responses) {
  const requests = [];
  return {
    requests,
    client: {
      from(table) {
        const request = { table };
        requests.push(request);
        return {
          update(payload) {
            request.payload = structuredClone(payload);
            return {
              eq(column, value) {
                request.filter = [column, value];
                return {
                  select(columns) {
                    request.columns = columns;
                    return {
                      async maybeSingle() {
                        request.single = true;
                        assert.ok(responses.length, "unexpected extra request");
                        const response = responses.shift();
                        if (response instanceof Error) throw response;
                        return response;
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test("completion returns the exact canonical server time and only checklist completion fields", async () => {
  const row = Object.freeze({
    id: checklistId,
    status: "completed",
    completed_at: serverTime,
    updated_at: serverUpdatedTime,
    title: "Deck maintenance",
    yacht_checklist_items: [{ id: "task-one", completed: true }],
    recurrence_enabled: true,
  });
  const { client, requests } = mockClient({ data: row, error: null });
  assert.deepEqual(await saveCrewChecklistCompletion(client, checklistId), {
    id: checklistId,
    status: "completed",
    completed_at: serverTime,
    updated_at: serverUpdatedTime,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].table, "yacht_checklists");
  assert.deepEqual(requests[0].filter, ["id", checklistId]);
  assert.equal(requests[0].columns, "*");
  assert.equal(requests[0].single, true);
  assert.equal(requests[0].payload.status, "completed");
  assert.ok(Number.isFinite(Date.parse(requests[0].payload.completed_at)));
  assert.deepEqual(Object.keys(requests[0].payload).sort(), ["completed_at", "status"]);
});

test("updated_at is optional when a canonical completion time is returned", async () => {
  for (const metadata of [{}, { updated_at: null }]) {
    const { client } = mockClient({
      data: { id: checklistId, status: "completed", completed_at: serverTime, ...metadata },
      error: null,
    });
    assert.deepEqual(await saveCrewChecklistCompletion(client, checklistId), {
      id: checklistId,
      status: "completed",
      completed_at: serverTime,
    });
  }
});

test("zero affected rows cannot be reported as successful completion", async () => {
  const { client, requests } = mockClient({ data: null, error: null });
  await assert.rejects(saveCrewChecklistCompletion(client, checklistId), /could not be confirmed/);
  assert.equal(requests.length, 1);
});

test("wrong IDs, incomplete status and malformed completion timestamps are rejected", async () => {
  const invalidRows = [
    undefined,
    [],
    {},
    { id: "other-checklist", status: "completed", completed_at: serverTime },
    { id: checklistId, status: "open", completed_at: serverTime },
    { id: checklistId, status: true, completed_at: serverTime },
    { id: checklistId, status: "completed" },
    ...[null, "", "   ", "not-a-date", "2026-13-01T00:00:00Z", 123, {}].map((completed_at) => ({
      id: checklistId,
      status: "completed",
      completed_at,
      updated_at: serverUpdatedTime,
    })),
    { id: checklistId, status: "completed", completed_at: serverTime, updated_at: "not-a-date" },
  ];
  for (const row of invalidRows) {
    const { client, requests } = mockClient({ data: row, error: null });
    await assert.rejects(saveCrewChecklistCompletion(client, checklistId), /could not be confirmed/);
    assert.equal(requests.length, 1);
  }
});

test("permission and unfinished-task errors are surfaced without retrying", async () => {
  for (const error of [
    { code: "42501", message: "A completed checklist is immutable." },
    { code: "42501", message: "new row violates row-level security policy" },
    { code: "23514", message: "Every checklist task must be completed first." },
  ]) {
    const { client, requests } = mockClient({ data: null, error });
    await assert.rejects(
      saveCrewChecklistCompletion(client, checklistId),
      (caught) => caught instanceof Error && caught.message === error.message,
    );
    assert.equal(requests.length, 1);
  }
});

test("network exceptions propagate without retrying an uncertain completion", async () => {
  const networkError = new TypeError("Failed to fetch");
  const { client, requests } = mockClient(networkError);
  await assert.rejects(saveCrewChecklistCompletion(client, checklistId), (error) => error === networkError);
  assert.equal(requests.length, 1);
});

test("schema cache fallback submits only status and accepts a legacy server update timestamp", async () => {
  const { client, requests } = mockClient(
    { data: null, error: schemaError },
    { data: { id: checklistId, status: "completed", updated_at: serverUpdatedTime }, error: null },
  );
  assert.deepEqual(await saveCrewChecklistCompletion(client, checklistId), {
    id: checklistId,
    status: "completed",
    completed_at: serverUpdatedTime,
    updated_at: serverUpdatedTime,
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], {
    table: "yacht_checklists",
    payload: { status: "completed" },
    filter: ["id", checklistId],
    columns: "*",
    single: true,
  });
});

test("fallback prioritizes canonical completed_at when both timestamps are returned", async () => {
  const row = { id: checklistId, status: "completed", completed_at: serverTime, updated_at: serverUpdatedTime };
  const { client } = mockClient(
    { data: null, error: { message: "Missing column", hint: "Schema cache needs refreshing" } },
    { data: row, error: null },
  );
  assert.deepEqual(await saveCrewChecklistCompletion(client, checklistId), row);
});

test("legacy fallback cannot invent a completion timestamp from the client clock", async () => {
  for (const updated_at of [undefined, null, "", "not-a-date", 123]) {
    const { client, requests } = mockClient(
      { data: null, error: schemaError },
      { data: { id: checklistId, status: "completed", updated_at }, error: null },
    );
    await assert.rejects(saveCrewChecklistCompletion(client, checklistId), /could not be confirmed/);
    assert.equal(requests.length, 2);
  }
});

test("fallback still rejects zero rows, wrong status and a second database error", async () => {
  for (const response of [
    { data: null, error: null },
    { data: { id: checklistId, status: "open", updated_at: serverUpdatedTime }, error: null },
    { data: null, error: schemaError },
    { data: null, error: { code: "42501", message: "permission denied" } },
  ]) {
    const { client, requests } = mockClient({ data: null, error: schemaError }, response);
    await assert.rejects(saveCrewChecklistCompletion(client, checklistId));
    assert.equal(requests.length, 2);
  }
});
