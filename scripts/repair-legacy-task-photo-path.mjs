import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const expectedProjectRef = "onftggrmmpvvwgxxzywo";
const applyChanges = process.argv.includes("--apply");
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase maintenance credentials are required.");
}
if (new URL(supabaseUrl).hostname.split(".")[0] !== expectedProjectRef) {
  throw new Error("Refusing to repair an unexpected Supabase project.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const [checklists, items] = await Promise.all([
  loadAllRows("yacht_checklists", "id,yacht_id"),
  loadAllRows(
    "yacht_checklist_items",
    "id,checklist_id,before_photo_url,after_photo_url,note",
  ),
]);
const yachtByChecklist = new Map(
  checklists.map((checklist) => [checklist.id, checklist.yacht_id]),
);
const candidates = [];

for (const item of items) {
  const yachtId = yachtByChecklist.get(item.checklist_id);
  if (!isUuid(item.id) || !isUuid(yachtId)) continue;
  const references = supportedReferences(item);
  const legacyPaths = new Set();
  for (const reference of references) {
    const path = normalizeTaskPhotoReference(reference);
    if (!path) continue;
    const segments = path.split("/");
    if (
      segments.length === 3 &&
      isUuid(segments[0]) &&
      segments[1].toLowerCase() === item.id.toLowerCase() &&
      segments[0].toLowerCase() !== yachtId.toLowerCase()
    ) {
      legacyPaths.add(path);
    }
  }
  for (const sourcePath of legacyPaths) {
    const fileName = sourcePath.split("/")[2];
    candidates.push({
      item,
      sourcePath,
      targetPath: `${yachtId}/${item.id}/${fileName}`,
    });
  }
}

if (candidates.length === 0) {
  console.log(JSON.stringify({ ok: true, candidates: 0, repaired: 0 }));
  process.exit(0);
}
if (candidates.length !== 1) {
  throw new Error(
    `Refusing an ambiguous repair set (${candidates.length} candidates).`,
  );
}
if (!applyChanges) {
  console.log(
    JSON.stringify({ ok: true, candidates: candidates.length, repaired: 0 }),
  );
  process.exit(0);
}

const candidate = candidates[0];
const sourceExists = await exactObjectExists(candidate.sourcePath);
if (!sourceExists) throw new Error("The referenced legacy object is missing.");

let createdTarget = false;
const targetExists = await exactObjectExists(candidate.targetPath);
if (!targetExists) {
  const copy = await supabase.storage
    .from("task-photos")
    .copy(candidate.sourcePath, candidate.targetPath);
  if (copy.error) throw new Error("The canonical object copy failed.");
  createdTarget = true;
}

const [sourceDigest, targetDigest] = await Promise.all([
  objectDigest(candidate.sourcePath),
  objectDigest(candidate.targetPath),
]);
if (sourceDigest !== targetDigest) {
  if (createdTarget) {
    await supabase.storage.from("task-photos").remove([candidate.targetPath]);
  }
  throw new Error("The canonical object did not match its source.");
}

const original = {
  before_photo_url: candidate.item.before_photo_url,
  after_photo_url: candidate.item.after_photo_url,
  note: candidate.item.note,
};
const replacement = {
  before_photo_url: replaceTaskPhotoReference(
    candidate.item.before_photo_url,
    candidate.sourcePath,
    candidate.targetPath,
  ),
  after_photo_url: replaceTaskPhotoReference(
    candidate.item.after_photo_url,
    candidate.sourcePath,
    candidate.targetPath,
  ),
  note: replaceNoteReferences(
    candidate.item.note,
    candidate.sourcePath,
    candidate.targetPath,
  ),
};
if (
  JSON.stringify(original) === JSON.stringify(replacement) ||
  supportedReferences(replacement).some(
    (value) => normalizeTaskPhotoReference(value) === candidate.sourcePath,
  )
) {
  if (createdTarget) {
    await supabase.storage.from("task-photos").remove([candidate.targetPath]);
  }
  throw new Error("The database reference could not be rewritten safely.");
}

const update = await supabase
  .from("yacht_checklist_items")
  .update(replacement)
  .eq("id", candidate.item.id)
  .eq("checklist_id", candidate.item.checklist_id)
  .select("id")
  .single();
if (update.error) {
  if (createdTarget) {
    await supabase.storage.from("task-photos").remove([candidate.targetPath]);
  }
  throw new Error("The checklist evidence reference update failed.");
}

const queued = await supabase.rpc(
  "bluedeck_queue_canonical_task_photo_repair",
  {
    p_item_id: candidate.item.id,
    p_old_object_name: candidate.sourcePath,
    p_new_object_name: candidate.targetPath,
  },
);
if (queued.error || queued.data !== true) {
  const rollback = await supabase
    .from("yacht_checklist_items")
    .update(original)
    .eq("id", candidate.item.id)
    .eq("checklist_id", candidate.item.checklist_id);
  if (!rollback.error && createdTarget) {
    await supabase.storage.from("task-photos").remove([candidate.targetPath]);
  }
  throw new Error("The legacy object could not be queued for safe deletion.");
}

console.log(
  JSON.stringify({ ok: true, candidates: candidates.length, repaired: 1 }),
);

async function loadAllRows(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1_000) {
    const response = await supabase
      .from(table)
      .select(select)
      .range(from, from + 999);
    if (response.error) throw new Error(`Could not inspect ${table}.`);
    rows.push(...(response.data || []));
    if (!response.data || response.data.length < 1_000) return rows;
  }
}

function supportedReferences(item) {
  const values = [item.before_photo_url, item.after_photo_url];
  const note = parseNote(item.note);
  if (note) collectStrings(note, values);
  return values.filter((value) => typeof value === "string");
}

function collectStrings(value, output) {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, output);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectStrings(entry, output);
  }
}

function normalizeTaskPhotoReference(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  let normalized = value.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return "";
  }
  const marker = "/task-photos/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0)
    normalized = normalized.slice(markerIndex + marker.length);
  normalized = normalized
    .replace(/^\/?task-photos\//, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/.test(normalized) &&
    !normalized.includes("..")
    ? normalized
    : "";
}

function replaceTaskPhotoReference(value, sourcePath, targetPath) {
  if (
    typeof value !== "string" ||
    normalizeTaskPhotoReference(value) !== sourcePath
  ) {
    return value;
  }
  const replaced = value.replace(sourcePath, targetPath);
  if (replaced === value)
    throw new Error("A legacy reference was encoded unexpectedly.");
  return replaced;
}

function replaceNoteReferences(noteValue, sourcePath, targetPath) {
  const parsed = parseNote(noteValue);
  if (!parsed) return noteValue;
  return JSON.stringify(replaceNested(parsed, sourcePath, targetPath));
}

function replaceNested(value, sourcePath, targetPath) {
  if (typeof value === "string") {
    return replaceTaskPhotoReference(value, sourcePath, targetPath);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceNested(entry, sourcePath, targetPath));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceNested(entry, sourcePath, targetPath),
      ]),
    );
  }
  return value;
}

function parseNote(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function exactObjectExists(path) {
  const segments = path.split("/");
  const fileName = segments.pop();
  const folder = segments.join("/");
  const listed = await supabase.storage
    .from("task-photos")
    .list(folder, { limit: 100, search: fileName });
  if (listed.error)
    throw new Error("Task-photo Storage could not be inspected.");
  return (listed.data || []).some((entry) => entry.name === fileName);
}

async function objectDigest(path) {
  const downloaded = await supabase.storage.from("task-photos").download(path);
  if (downloaded.error || !downloaded.data) {
    throw new Error("Task-photo evidence could not be verified.");
  }
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  return `${bytes.byteLength}:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
