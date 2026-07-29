import "server-only";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();
const maxBucketCount = 5_000;

/**
 * A small per-isolate guard for expensive endpoints. Cloudflare can run more
 * than one isolate, so platform-level rate limiting should remain the outer
 * production control.
 */
export function consumeRequestRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    trimBuckets(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function trimBuckets(now: number) {
  if (buckets.size <= maxBucketCount) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size > maxBucketCount) {
    const oldestKey = buckets.keys().next().value;
    if (typeof oldestKey !== "string") break;
    buckets.delete(oldestKey);
  }
}
