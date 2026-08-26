type Fetcher = typeof fetch;

export async function revokeSupabaseSessionWithRefresh({
  accessToken,
  anonKey,
  fetcher = fetch,
  refreshToken,
  stepDeadlineMs = 4_000,
  supabaseUrl,
}: {
  accessToken: string;
  anonKey: string;
  fetcher?: Fetcher;
  refreshToken: string;
  stepDeadlineMs?: number;
  supabaseUrl: string;
}) {
  let refreshedAccessToken = "";
  if (refreshToken) {
    try {
      refreshedAccessToken = await withDeadline(stepDeadlineMs, (signal) =>
        exchangeRefreshToken(
          fetcher,
          supabaseUrl,
          anonKey,
          refreshToken,
          signal,
        ),
      );
    } catch {
      // A still-valid access token remains a useful fallback.
    }
  }

  const revocationToken = refreshedAccessToken || accessToken;
  if (!revocationToken) return;

  try {
    await withDeadline(stepDeadlineMs, (signal) =>
      revokeLocalSession(
        fetcher,
        supabaseUrl,
        anonKey,
        revocationToken,
        signal,
      ),
    );
  } catch {
    // Local browser termination has already completed.
  }
}

async function exchangeRefreshToken(
  fetcher: Fetcher,
  supabaseUrl: string,
  anonKey: string,
  refreshToken: string,
  signal: AbortSignal,
) {
  const response = await fetcher(
    `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        "X-Supabase-Api-Version": "2024-01-01",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    },
  );
  if (!response.ok) return "";

  const body = (await response.json()) as { access_token?: unknown };
  return plausibleAccessToken(body.access_token);
}

async function revokeLocalSession(
  fetcher: Fetcher,
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  signal: AbortSignal,
) {
  await fetcher(`${supabaseUrl}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "X-Supabase-Api-Version": "2024-01-01",
    },
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal,
  });
}

async function withDeadline<T>(
  deadlineMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  const deadlineId = setTimeout(() => controller.abort(), deadlineMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(deadlineId);
  }
}

function plausibleAccessToken(value: unknown) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 32_768 &&
    value.split(".").length === 3
    ? value
    : "";
}
