// Network failures can be retried in place; an absent or expired session
// requires signing in again instead of an endless workspace retry.
export function isExpiredAuthSession(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; status?: unknown; code?: unknown };
  return (
    candidate.name === "AuthSessionMissingError" ||
    candidate.status === 401 ||
    (typeof candidate.code === "string" &&
      [
        "bad_jwt",
        "no_authorization",
        "user_not_found",
        "session_not_found",
        "session_expired",
        "refresh_token_not_found",
        "refresh_token_already_used",
      ].includes(candidate.code))
  );
}
