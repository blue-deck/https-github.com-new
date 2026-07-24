import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const crewDocumentsBucket = "crew-documents";
const signedUrlLifetimeSeconds = 5 * 60;
const maxStorageReferenceLength = 4_096;
const storageUrlPrefixes = [
  `/storage/v1/object/public/${crewDocumentsBucket}/`,
  `/storage/v1/object/sign/${crewDocumentsBucket}/`,
  `/storage/v1/object/authenticated/${crewDocumentsBucket}/`,
];

type CrewDocumentRow = Record<string, unknown> & {
  file_url?: unknown;
};

export function normalizeCrewDocumentStoragePath(
  value: unknown,
  profileId: string,
  configuredSupabaseUrl: string,
) {
  if (typeof value !== "string") return null;

  const reference = value.trim();
  if (!reference) return "";
  if (reference.length > maxStorageReferenceLength) return null;

  let path = reference;

  try {
    const url = new URL(reference);
    const expectedOrigin = new URL(configuredSupabaseUrl).origin;
    if (url.origin !== expectedOrigin || url.username || url.password) {
      return null;
    }

    const prefix = storageUrlPrefixes.find((candidate) =>
      url.pathname.startsWith(candidate),
    );
    if (!prefix) return null;
    path = url.pathname.slice(prefix.length);
  } catch {
    path = reference.split(/[?#]/, 1)[0] || "";
    path = path.replace(new RegExp(`^/?${crewDocumentsBucket}/`), "");
  }

  const decodedPath = decodeStoragePath(path);
  if (!decodedPath || decodedPath.length > 1_024) return null;
  if (
    decodedPath.startsWith("/") ||
    decodedPath.includes("\\") ||
    decodedPath.includes("\0") ||
    decodedPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  const [ownerSegment] = decodedPath.split("/");
  if (ownerSegment.toLowerCase() !== profileId.toLowerCase()) return null;

  return decodedPath;
}

export async function signCrewDocumentRows<T extends CrewDocumentRow>(
  client: SupabaseClient,
  rows: T[],
  profileId: string,
  configuredSupabaseUrl: string,
) {
  return Promise.all(
    rows.map((row) =>
      signCrewDocumentRow(client, row, profileId, configuredSupabaseUrl),
    ),
  );
}

export async function signCrewDocumentRow<T extends CrewDocumentRow>(
  client: SupabaseClient,
  row: T,
  profileId: string,
  configuredSupabaseUrl: string,
) {
  const storagePath = normalizeCrewDocumentStoragePath(
    row.file_url,
    profileId,
    configuredSupabaseUrl,
  );

  if (!storagePath) {
    return { ...row, file_url: "" };
  }

  try {
    const { data, error } = await client.storage
      .from(crewDocumentsBucket)
      .createSignedUrl(storagePath, signedUrlLifetimeSeconds);

    if (error || !data?.signedUrl) {
      return { ...row, file_url: "" };
    }

    return { ...row, file_url: data.signedUrl };
  } catch {
    return { ...row, file_url: "" };
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
