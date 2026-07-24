import type { SupabaseClient } from "@supabase/supabase-js";

const signedUrlLifetimeSeconds = 5 * 60;
const signedUrlBatchSize = 100;
const maxStorageReferenceLength = 4_096;
const maxStoragePathLength = 1_024;
const storageUrlPrefixes = [
  { prefix: "/storage/v1/object/public/", isPublic: true },
  { prefix: "/storage/v1/object/sign/", isPublic: false },
  { prefix: "/storage/v1/object/authenticated/", isPublic: false },
];

export type PrivateStorageReference = {
  value: unknown;
  defaultBucket: string;
  allowedBuckets: readonly string[];
  expectedPathOwner?: string;
  passthroughPublicBuckets?: readonly string[];
};

export type ParsedPrivateStorageReference = {
  bucket: string;
  path: string;
  usePublicUrl: boolean;
};

type ChecklistPhotoSigningOptions = {
  preserveRawReferences?: boolean;
};

export async function resolvePrivateStorageUrls(
  client: SupabaseClient,
  references: readonly PrivateStorageReference[],
  configuredSupabaseUrl: string,
) {
  const results = Array<string>(references.length).fill("");
  const pendingByBucket = new Map<
    string,
    Map<string, { indexes: number[] }>
  >();

  references.forEach((reference, index) => {
    const parsed = parsePrivateStorageReference(
      reference,
      configuredSupabaseUrl,
    );
    if (!parsed) return;

    if (parsed.usePublicUrl) {
      results[index] = client.storage
        .from(parsed.bucket)
        .getPublicUrl(parsed.path).data.publicUrl;
      return;
    }

    const paths =
      pendingByBucket.get(parsed.bucket) ||
      new Map<string, { indexes: number[] }>();
    const entry = paths.get(parsed.path) || { indexes: [] };
    entry.indexes.push(index);
    paths.set(parsed.path, entry);
    pendingByBucket.set(parsed.bucket, paths);
  });

  await Promise.all(
    Array.from(pendingByBucket.entries()).map(async ([bucket, pathEntries]) => {
      const paths = Array.from(pathEntries.keys());
      if (paths.length === 0) return;

      for (let offset = 0; offset < paths.length; offset += signedUrlBatchSize) {
        const batch = paths.slice(offset, offset + signedUrlBatchSize);

        try {
          const { data, error } = await client.storage
            .from(bucket)
            .createSignedUrls(batch, signedUrlLifetimeSeconds);

          if (error || !data) continue;

          data.forEach((signedReference) => {
            if (!signedReference.path || !signedReference.signedUrl) return;
            const entry = pathEntries.get(signedReference.path);
            entry?.indexes.forEach((index) => {
              results[index] = signedReference.signedUrl || "";
            });
          });
        } catch {
          // Keep the affected URL blank. Callers can still render the rest of
          // the record without exposing a stale or unauthorized storage URL.
        }
      }
    }),
  );

  return results;
}

export async function signChecklistTaskPhotoUrls<
  T extends Record<string, unknown>,
>(
  client: SupabaseClient,
  checklists: readonly T[],
  configuredSupabaseUrl: string,
  options: ChecklistPhotoSigningOptions = {},
) {
  if (options.preserveRawReferences) {
    return signChecklistPhotosWithoutReplacingReferences(
      client,
      checklists,
      configuredSupabaseUrl,
    );
  }

  const references: PrivateStorageReference[] = [];
  const assignments: Array<(url: string) => void> = [];
  const noteFinalizers: Array<() => void> = [];

  const signedChecklists = checklists.map((checklist) => {
    const yachtId = text(checklist.yacht_id);
    const rawItems = Array.isArray(checklist.yacht_checklist_items)
      ? checklist.yacht_checklist_items
      : [];
    const items = rawItems.map((rawItem) => {
      if (!isPlainRecord(rawItem)) return rawItem;

      const item: Record<string, unknown> = { ...rawItem };
      addPhotoReference(item, "before_photo_url", yachtId);
      addPhotoReference(item, "after_photo_url", yachtId);

      const parsedNote = parseTaskNote(item.note);
      if (parsedNote) {
        const note = { ...parsedNote.value };
        const photos = isPlainRecord(note.photos)
          ? { ...note.photos }
          : null;

        addPhotoReference(note, "before_photo_url", yachtId);
        addPhotoReference(note, "after_photo_url", yachtId);
        if (photos) {
          addPhotoReference(photos, "before", yachtId);
          addPhotoReference(photos, "after", yachtId);
          note.photos = photos;
        }

        noteFinalizers.push(() => {
          item.note = parsedNote.wasString ? JSON.stringify(note) : note;
        });
      }

      return item;
    });

    return {
      ...checklist,
      yacht_checklist_items: items,
    };
  });

  const urls = await resolvePrivateStorageUrls(
    client,
    references,
    configuredSupabaseUrl,
  );
  urls.forEach((url, index) => assignments[index]?.(url));
  noteFinalizers.forEach((finalize) => finalize());

  return signedChecklists;

  function addPhotoReference(
    target: Record<string, unknown>,
    key: string,
    yachtId: string,
  ) {
    const value = target[key];
    if (typeof value !== "string" || !value.trim()) return;
    if (!yachtId) {
      target[key] = "";
      return;
    }

    references.push({
      value,
      defaultBucket: "task-photos",
      allowedBuckets: ["task-photos"],
      expectedPathOwner: yachtId,
    });
    assignments.push((url) => {
      target[key] = url;
    });
  }
}

async function signChecklistPhotosWithoutReplacingReferences<
  T extends Record<string, unknown>,
>(
  client: SupabaseClient,
  checklists: readonly T[],
  configuredSupabaseUrl: string,
) {
  const references: PrivateStorageReference[] = [];
  const assignments: Array<(url: string) => void> = [];

  const signedChecklists = checklists.map((checklist) => {
    const yachtId = text(checklist.yacht_id);
    const rawItems = Array.isArray(checklist.yacht_checklist_items)
      ? checklist.yacht_checklist_items
      : [];
    const items = rawItems.map((rawItem) => {
      if (!isPlainRecord(rawItem)) return rawItem;

      const parsedNote = parseTaskNote(rawItem.note)?.value;
      const notePhotos = isPlainRecord(parsedNote?.photos)
        ? parsedNote.photos
        : null;
      const signedPhotos: Record<"before" | "after", string> = {
        before: "",
        after: "",
      };

      (["before", "after"] as const).forEach((type) => {
        const value = firstNonEmptyString(
          rawItem[`${type}_photo_url`],
          parsedNote?.[`${type}_photo_url`],
          notePhotos?.[type],
        );
        if (!value || !yachtId) return;

        references.push({
          value,
          defaultBucket: "task-photos",
          allowedBuckets: ["task-photos"],
          expectedPathOwner: yachtId,
        });
        assignments.push((url) => {
          signedPhotos[type] = url;
        });
      });

      return {
        ...rawItem,
        __bluedeck_signed_photos: signedPhotos,
      };
    });

    return {
      ...checklist,
      yacht_checklist_items: items,
    };
  });

  const urls = await resolvePrivateStorageUrls(
    client,
    references,
    configuredSupabaseUrl,
  );
  urls.forEach((url, index) => assignments[index]?.(url));

  return signedChecklists;
}

export function parsePrivateStorageReference(
  reference: PrivateStorageReference,
  configuredSupabaseUrl: string,
): ParsedPrivateStorageReference | null {
  if (typeof reference.value !== "string") return null;

  const value = reference.value.trim();
  if (!value || value.length > maxStorageReferenceLength) return null;

  let bucket = reference.defaultBucket;
  let path = value;
  let isPublicUrl = false;

  try {
    const url = new URL(value);
    const expectedUrl = new URL(configuredSupabaseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.protocol !== expectedUrl.protocol ||
      url.origin !== expectedUrl.origin ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const storagePrefix = storageUrlPrefixes.find(({ prefix }) =>
      url.pathname.startsWith(prefix),
    );
    if (!storagePrefix) return null;

    const storageReference = url.pathname.slice(storagePrefix.prefix.length);
    const bucketSeparator = storageReference.indexOf("/");
    if (bucketSeparator < 1) return null;

    bucket = decodeStorageSegment(
      storageReference.slice(0, bucketSeparator),
    );
    path = storageReference.slice(bucketSeparator + 1);
    isPublicUrl = storagePrefix.isPublic;
  } catch {
    path = value.split(/[?#]/, 1)[0] || "";
    path = path.replace(new RegExp(`^/?${escapeRegExp(bucket)}/`), "");
  }

  if (!reference.allowedBuckets.includes(bucket)) return null;

  const decodedPath = decodeStoragePath(path);
  if (
    !decodedPath ||
    decodedPath.length > maxStoragePathLength ||
    decodedPath.startsWith("/") ||
    decodedPath.includes("\\") ||
    decodedPath.includes("\0") ||
    decodedPath
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  const expectedOwner = reference.expectedPathOwner?.trim().toLowerCase();
  const [ownerSegment] = decodedPath.split("/");
  if (expectedOwner && ownerSegment.toLowerCase() !== expectedOwner) {
    return null;
  }

  const usePublicUrl =
    isPublicUrl &&
    Boolean(reference.passthroughPublicBuckets?.includes(bucket));

  return { bucket, path: decodedPath, usePublicUrl };
}

function firstNonEmptyString(...values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
}

function parseTaskNote(value: unknown) {
  if (isPlainRecord(value)) return { value, wasString: false };
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isPlainRecord(parsed)
      ? { value: parsed, wasString: true }
      : null;
  } catch {
    return null;
  }
}

function decodeStoragePath(value: string) {
  try {
    return value
      .replace(/^\/+/, "")
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return "";
  }
}

function decodeStorageSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
