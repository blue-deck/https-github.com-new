import assert from "node:assert/strict";
import test from "node:test";
import { saveCrewTaskCompletion } from "../app/lib/crewTaskCompletion.ts";

const taskId = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const callerEmail = "crew@example.invalid";
const serverTime = "2026-10-06T09:30:00+00:00";
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

test("completion returns canonical server metadata without replacing task content or proof", async () => {
  const row = Object.freeze({
    id: taskId,
    completed: true,
    completed_at: serverTime,
    completed_by: actorId,
    task_text: "Inspect deck",
    note: '{"after_photo_url":"private/raw.jpg"}',
    after_photo_url: "private/raw.jpg",
  });
  const { client, requests } = mockClient({ data: row, error: null });
  const result = await saveCrewTaskCompletion(client, taskId, true, callerEmail);

  assert.deepEqual(result, {
    id: taskId,
    completed: true,
    completed_at: serverTime,
    completed_by: actorId,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].table, "yacht_checklist_items");
  assert.deepEqual(requests[0].filter, ["id", taskId]);
  assert.equal(requests[0].columns, "*");
  assert.equal(requests[0].single, true);
  assert.equal(requests[0].payload.completed, true);
  assert.equal(requests[0].payload.completed_by, callerEmail);
  assert.ok(Number.isFinite(Date.parse(requests[0].payload.completed_at)));
  assert.deepEqual(Object.keys(requests[0].payload).sort(), ["completed", "completed_at", "completed_by"]);

  const currentTask = { ...row, note: "existing note", __bluedeck_signed_photos: { after: "signed/photo.jpg" } };
  const mergedTask = { ...currentTask, ...result };
  assert.equal(mergedTask.note, currentTask.note);
  assert.equal(mergedTask.__bluedeck_signed_photos, currentTask.__bluedeck_signed_photos);
});

test("undo sends null audit metadata and returns the confirmed incomplete state", async () => {
  const row = { id: taskId, completed: false, completed_at: null, completed_by: null };
  const { client, requests } = mockClient({ data: row, error: null });

  assert.deepEqual(await saveCrewTaskCompletion(client, taskId, false, callerEmail), row);
  assert.deepEqual(requests[0].payload, { completed: false, completed_at: null, completed_by: null });
});

test("zero affected rows are an error even when PostgREST reports no error", async () => {
  const { client, requests } = mockClient({ data: null, error: null });
  await assert.rejects(saveCrewTaskCompletion(client, taskId, true, callerEmail), /could not be confirmed/);
  assert.equal(requests.length, 1);
});

test("rejects wrong task IDs, malformed data and an unconfirmed completion value", async () => {
  const invalidRows = [
    undefined,
    [],
    {},
    { id: "other-task", completed: true },
    { id: taskId, completed: "true" },
    { id: taskId, completed: false },
    { id: taskId, completed: true, completed_at: 123 },
    { id: taskId, completed: true, completed_by: {} },
  ];
  for (const row of invalidRows) {
    const { client, requests } = mockClient({ data: row, error: null });
    await assert.rejects(saveCrewTaskCompletion(client, taskId, true, callerEmail), /could not be confirmed/);
    assert.equal(requests.length, 1);
  }
});

test("permission and other database errors are surfaced without retrying", async () => {
  for (const error of [
    { code: "42501", message: "Only proof may be corrected during the completion window." },
    { code: "42501", message: "new row violates row-level security policy" },
    { code: "23503", message: "Checklist task parent does not exist." },
  ]) {
    const { client, requests } = mockClient({ data: null, error });
    await assert.rejects(
      saveCrewTaskCompletion(client, taskId, true, callerEmail),
      (caught) => caught instanceof Error && caught.message === error.message,
    );
    assert.equal(requests.length, 1);
  }
});

test("network exceptions propagate without retrying an uncertain write", async () => {
  const networkError = new TypeError("Failed to fetch");
  const { client, requests } = mockClient(networkError);
  await assert.rejects(saveCrewTaskCompletion(client, taskId, true, callerEmail), (error) => error === networkError);
  assert.equal(requests.length, 1);
});

test("schema cache errors retry only completion and do not invent missing legacy fields", async () => {
  for (const completed of [true, false]) {
    const { client, requests } = mockClient(
      { data: null, error: schemaError },
      { data: { id: taskId, completed }, error: null },
    );
    assert.deepEqual(await saveCrewTaskCompletion(client, taskId, completed, callerEmail), { id: taskId, completed });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1], {
      table: "yacht_checklist_items",
      payload: { completed },
      filter: ["id", taskId],
      columns: "*",
      single: true,
    });
  }
});

test("fallback still uses canonical fields when the server returns them", async () => {
  const row = { id: taskId, completed: true, completed_at: serverTime, completed_by: actorId };
  const { client } = mockClient(
    { data: null, error: { message: "Missing column", details: "Schema cache needs refreshing" } },
    { data: row, error: null },
  );
  assert.deepEqual(await saveCrewTaskCompletion(client, taskId, true, callerEmail), row);
});

test("fallback cannot convert zero rows or a failed second update into success", async () => {
  for (const response of [
    { data: null, error: null },
    { data: null, error: schemaError },
    { data: null, error: { code: "42501", message: "permission denied" } },
  ]) {
    const { client, requests } = mockClient({ data: null, error: schemaError }, response);
    await assert.rejects(saveCrewTaskCompletion(client, taskId, true, callerEmail));
    assert.equal(requests.length, 2);
  }
});
