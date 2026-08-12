import "server-only";

import type { PublicJobCard, PublicJobPost } from "./jobPosts";
import {
  currentPublicJobPostIds,
  jobPostServiceClient,
  logJobPostError,
  publicJobPostFromRow,
  publicJobPostServiceSelect,
} from "./jobPostsServer";
import {
  comparePublicJobs,
  decodePublicJobSearchCursor,
  encodePublicJobSearchCursor,
  matchesPublicJobSearch,
  publicJobSearchAnchor,
  publicJobSearchPageStartIndex,
  publicJobSearchResultFingerprint,
  type PublicJobSearchFilters,
} from "./publicJobSearch";

const publicJobScanBatchSize = 100;
const maximumPublicJobRowsToScan = 5_000;
const publicJobCursorLifetimeMs = 60 * 60 * 1_000;
const maximumClockSkewMs = 60 * 1_000;

export type PublicJobSearchServerResult =
  | {
      ok: true;
      jobs: PublicJobCard[];
      total: number;
      limit: number;
      nextCursor: string | null;
      hasMore: boolean;
    }
  | { ok: false; error: string; status: 400 | 500 | 503 };

export async function searchPublicJobs(
  filters: PublicJobSearchFilters,
  cursorToken: string | null,
): Promise<PublicJobSearchServerResult> {
  const service = jobPostServiceClient();
  if (!service.ok) {
    return { ok: false, error: service.error, status: 503 };
  }

  const cursorKey = await derivePublicJobCursorKey();
  if (!cursorKey) {
    logJobPostError("public_search_cursor_key_unavailable");
    return {
      ok: false,
      error: "The job board is temporarily unavailable.",
      status: 503,
    };
  }

  const requestTime = Date.now();
  const activeAt = new Date(requestTime).toISOString();
  let snapshotAt = new Date(requestTime).toISOString();
  let cursorAnchor = null;
  let expectedResultFingerprint: string | null = null;
  let expectedTotal: number | null = null;
  if (cursorToken) {
    const cursor = await decodePublicJobSearchCursor({
      filters,
      token: cursorToken,
      key: cursorKey,
    });
    if (!cursor || !validSnapshot(cursor.snapshotAt, requestTime)) {
      return {
        ok: false,
        error: "The job search has expired or is invalid. Please search again.",
        status: 400,
      };
    }
    snapshotAt = cursor.snapshotAt;
    cursorAnchor = cursor.anchor;
    expectedResultFingerprint = cursor.resultFingerprint;
    expectedTotal = cursor.total;
  }

  const matches: PublicJobPost[] = [];
  const scannedRecords: unknown[] = [];
  let scannedRows = 0;
  let exhausted = false;
  let scanAfter: PublicJobScanKey | null = null;

  while (scannedRows < maximumPublicJobRowsToScan) {
    let query = service.client
      .from("job_posts")
      .select(publicJobPostServiceSelect)
      .eq("status", "published")
      .lte("published_at", snapshotAt)
      .gt("closes_at", activeAt);
    if (scanAfter) query = applyScanKeyset(query, scanAfter);
    const { data, error } = await query
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(publicJobScanBatchSize);

    if (error || !Array.isArray(data)) {
      logJobPostError("public_search_scan_failed", error, {
        scannedRows,
      });
      return searchUnavailable();
    }

    scannedRecords.push(...data);
    scannedRows += data.length;
    if (data.length < publicJobScanBatchSize) {
      exhausted = true;
      break;
    }
    scanAfter = recordScanKey(data.at(-1));
    if (!scanAfter) {
      logJobPostError("public_search_invalid_scan_key", undefined, {
        scannedRows,
      });
      return searchUnavailable(500);
    }
  }

  if (!exhausted) {
    if (!scanAfter) return searchUnavailable(500);
    let query = service.client
      .from("job_posts")
      .select("id,published_at")
      .eq("status", "published")
      .lte("published_at", snapshotAt)
      .gt("closes_at", activeAt);
    query = applyScanKeyset(query, scanAfter);
    const { data, error } = await query
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(1);

    if (error || !Array.isArray(data)) {
      logJobPostError("public_search_capacity_probe_failed", error);
      return searchUnavailable();
    }
    if (data.length > 0) {
      // Never return a plausible-but-incomplete result set.
      logJobPostError("public_search_scan_capacity_exceeded", undefined, {
        maximumRows: maximumPublicJobRowsToScan,
      });
      return searchUnavailable();
    }
  }

  const authorityBatches: unknown[][] = [];
  for (
    let index = 0;
    index < scannedRecords.length;
    index += publicJobScanBatchSize
  ) {
    authorityBatches.push(
      scannedRecords.slice(index, index + publicJobScanBatchSize),
    );
  }
  const authorizedIds = new Set<string>();
  const authorityConcurrency = 8;
  for (
    let index = 0;
    index < authorityBatches.length;
    index += authorityConcurrency
  ) {
    const wave = authorityBatches.slice(index, index + authorityConcurrency);
    const results = await Promise.all(
      wave.map((rows) => currentPublicJobPostIds(service.client, rows)),
    );
    for (const result of results) {
      if (!result.ok) {
        logJobPostError("public_search_authority_failed", result.error, {
          batch: index,
        });
        return searchUnavailable();
      }
      for (const id of result.jobPostIds) authorizedIds.add(id);
    }
  }

  // Parsing and matching only begin after authority has been confirmed for all
  // rows in the frozen publication window.
  for (const row of scannedRecords) {
    const id = recordId(row);
    if (!id || !authorizedIds.has(id)) continue;
    const job = publicJobPostFromRow(row);
    if (!job) {
      logJobPostError("invalid_public_job_search_record", undefined, {
        recordId: id,
      });
      return {
        ok: false,
        error: "Job posts could not be loaded.",
        status: 500,
      };
    }
    if (matchesPublicJobSearch(job, filters)) matches.push(job);
  }

  matches.sort((left, right) => comparePublicJobs(left, right, filters.sort));
  const resultFingerprint = await publicJobSearchResultFingerprint(matches);
  if (!resultFingerprint) {
    logJobPostError("public_search_result_fingerprint_failed");
    return searchUnavailable();
  }
  if (
    expectedResultFingerprint !== null &&
    (expectedResultFingerprint !== resultFingerprint ||
      expectedTotal !== matches.length)
  ) {
    return {
      ok: false,
      error: "Job results changed. Refresh the search before loading more.",
      status: 400,
    };
  }
  const startIndex = publicJobSearchPageStartIndex(
    matches,
    filters.sort,
    cursorAnchor,
  );
  const page = matches.slice(startIndex, startIndex + filters.limit);
  const hasMore = startIndex + page.length < matches.length;
  let nextCursor: string | null = null;

  if (hasMore) {
    const lastJob = page.at(-1);
    if (!lastJob) return searchUnavailable();
    nextCursor = await encodePublicJobSearchCursor({
      filters,
      payload: {
        snapshotAt,
        resultFingerprint,
        total: matches.length,
        anchor: publicJobSearchAnchor(lastJob, filters.sort),
      },
      key: cursorKey,
    });
    if (!nextCursor) {
      logJobPostError("public_search_cursor_encode_failed");
      return searchUnavailable();
    }
  }

  return {
    ok: true,
    jobs: page.map(publicJobCardFromPost),
    total: matches.length,
    limit: filters.limit,
    nextCursor,
    hasMore,
  };
}

function publicJobCardFromPost(job: PublicJobPost): PublicJobCard {
  return {
    id: job.id,
    position: job.position,
    employmentType: job.employmentType,
    candidateType: job.candidateType,
    yachtType: job.yachtType,
    yachtLength: job.yachtLength,
    yachtLengthUnit: job.yachtLengthUnit,
    location: job.location,
    startDate: job.startDate,
    salary: job.salary,
    publishedAt: job.publishedAt,
  };
}

async function derivePublicJobCursorKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const cryptoApi = globalThis.crypto;
  if (!secret || !cryptoApi?.subtle) return null;
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`bluedeck-public-job-search-cursor-v1:${secret}`),
  );
  return new Uint8Array(digest);
}

function validSnapshot(value: string, requestTime: number) {
  const snapshot = Date.parse(value);
  return (
    Number.isFinite(snapshot) &&
    snapshot <= requestTime + maximumClockSkewMs &&
    requestTime - snapshot <= publicJobCursorLifetimeMs
  );
}

function recordId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" ? id : "";
}

type PublicJobScanKey = { publishedAt: string; id: string };

function recordScanKey(value: unknown): PublicJobScanKey | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      record.id,
    ) ||
    typeof record.published_at !== "string"
  ) {
    return null;
  }
  const timestamp = Date.parse(record.published_at);
  if (!Number.isFinite(timestamp)) return null;
  return {
    publishedAt: new Date(timestamp).toISOString(),
    id: record.id.toLowerCase(),
  };
}

function applyScanKeyset<Query extends { or: (filter: string) => Query }>(
  query: Query,
  key: PublicJobScanKey,
) {
  return query.or(
    `published_at.lt.${key.publishedAt},and(published_at.eq.${key.publishedAt},id.gt.${key.id})`,
  );
}

function searchUnavailable(
  status: 500 | 503 = 503,
): PublicJobSearchServerResult {
  return {
    ok: false,
    error: "Job posts could not be loaded.",
    status,
  };
}
