import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePrivateStorageReference } from "./privateStorageUrls";

export const crewPortfolioBucket = "crew-portfolio";
export const crewPortfolioProxySignedUrlLifetimeSeconds = 5 * 60;

const ownerSignedUrlLifetimeSeconds = 60 * 60;
const signedUrlBatchSize = 100;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCrewPortfolioStoragePath(
  value: unknown,
  ownerIds: readonly unknown[],
  configuredSupabaseUrl: string,
) {
  const parsed = parsePrivateStorageReference(
    {
      value,
      defaultBucket: crewPortfolioBucket,
      allowedBuckets: [crewPortfolioBucket],
    },
    configuredSupabaseUrl,
  );
  if (!parsed) return null;

  const [ownerSegment] = parsed.path.split("/");
  if (!uuidPattern.test(ownerSegment)) return null;

  const allowedOwners = new Set(
    ownerIds
      .filter((ownerId): ownerId is string => typeof ownerId === "string")
      .map((ownerId) => ownerId.trim().toLowerCase())
      .filter((ownerId) => uuidPattern.test(ownerId)),
  );
  if (
    allowedOwners.size > 0 &&
    !allowedOwners.has(ownerSegment.toLowerCase())
  ) {
    return null;
  }

  return parsed.path;
}

export async function signCrewPortfolioReference(
  client: SupabaseClient,
  value: unknown,
  ownerIds: readonly unknown[],
  configuredSupabaseUrl: string,
  expiresInSeconds = ownerSignedUrlLifetimeSeconds,
) {
  const [signedUrl] = await signCrewPortfolioReferences(
    client,
    [value],
    ownerIds,
    configuredSupabaseUrl,
    expiresInSeconds,
  );
  return signedUrl || "";
}

export async function signCrewPortfolioReferences(
  client: SupabaseClient,
  values: readonly unknown[],
  ownerIds: readonly unknown[],
  configuredSupabaseUrl: string,
  expiresInSeconds = ownerSignedUrlLifetimeSeconds,
) {
  const results = Array<string>(values.length).fill("");
  const indexesByPath = new Map<string, number[]>();

  values.forEach((value, index) => {
    const path = normalizeCrewPortfolioStoragePath(
      value,
      ownerIds,
      configuredSupabaseUrl,
    );
    if (!path) return;

    const indexes = indexesByPath.get(path) || [];
    indexes.push(index);
    indexesByPath.set(path, indexes);
  });

  const paths = Array.from(indexesByPath.keys());
  if (paths.length === 0) return results;
  const signedUrlLifetimeSeconds = normalizeSignedUrlLifetime(expiresInSeconds);

  for (let offset = 0; offset < paths.length; offset += signedUrlBatchSize) {
    const batch = paths.slice(offset, offset + signedUrlBatchSize);

    try {
      const { data, error } = await client.storage
        .from(crewPortfolioBucket)
        .createSignedUrls(batch, signedUrlLifetimeSeconds);
      if (error || !data) continue;

      data.forEach((reference) => {
        if (!reference.path || !reference.signedUrl) return;
        indexesByPath.get(reference.path)?.forEach((index) => {
          results[index] = reference.signedUrl || "";
        });
      });
    } catch {
      // A missing or unauthorized object stays blank. Callers must never fall
      // back to a permanent public URL for this private bucket.
    }
  }

  return results;
}

function normalizeSignedUrlLifetime(value: number) {
  if (!Number.isFinite(value)) return ownerSignedUrlLifetimeSeconds;
  return Math.min(60 * 60, Math.max(60, Math.floor(value)));
}
