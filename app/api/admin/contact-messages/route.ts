import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTACT_INBOX_STATUSES,
  isContactInboxStatus,
  type ContactInboxCounts,
} from "../../../lib/contactInbox";
import {
  contactInboxClients,
  contactInboxMessageFromRow,
  contactInboxPageSize,
  contactInboxSelect,
  encodeContactInboxCursor,
  isContactInboxTimestamp,
  parseContactInboxQuery,
} from "../../../lib/contactInboxServer";
import { isUuid } from "../../../lib/employerAccessServer";
import { privateNextResponse as NextResponse } from "../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const clients = await contactInboxClients(request);
    if ("error" in clients) return failure(clients.error, clients.status);
    const limit = inboxRateLimit("read", clients.adminUser.id, 180);
    if (limit) return limit;
    const parameters = parseContactInboxQuery(request.nextUrl.searchParams);
    if (!parameters) return failure("Invalid inbox request.", 400);

    let query = clients.serviceClient.from("contact_messages")
      .select(contactInboxSelect)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(contactInboxPageSize + 1)
      .abortSignal(AbortSignal.timeout(8_000)).retry(false);
    if (parameters.status !== "all") query = query.eq("status", parameters.status);
    if (parameters.cursor) {
      const { createdAt, id } = parameters.cursor;
      query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
    }
    const [result, counts] = await Promise.all([query, loadCounts(clients.serviceClient)]);
    if (result.error || !Array.isArray(result.data) || !counts) {
      return failure("The contact inbox could not be loaded.", 503);
    }
    const messages = result.data.slice(0, contactInboxPageSize).map(contactInboxMessageFromRow);
    if (messages.some((message) => !message)) return failure("The contact inbox could not be loaded.", 503);
    const hasMore = result.data.length > contactInboxPageSize;
    const last = messages.at(-1);
    const nextCursor = hasMore && last
      ? encodeContactInboxCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return NextResponse.json({ ok: true, messages, counts, nextCursor, hasMore });
  } catch {
    return failure("The contact inbox is temporarily unavailable.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return failure("This request is not allowed.", 403);
  try {
    const clients = await contactInboxClients(request);
    if ("error" in clients) return failure(clients.error, clients.status);
    const limit = inboxRateLimit("update", clients.adminUser.id, 120);
    if (limit) return limit;
    const parsed = await readLimitedJsonObjectDetailed(request, 2048);
    if (!parsed.ok) {
      return failure("Invalid inbox update.", parsed.error === "too-large" ? 413 : parsed.error === "content-type" ? 415 : 400);
    }
    const body = parsed.value;
    if (Object.keys(body).length !== 3 || typeof body.id !== "string" || !isUuid(body.id) ||
        !isContactInboxStatus(body.status) || !isContactInboxTimestamp(body.updatedAt)) {
      return failure("Invalid inbox update.", 400);
    }
    // One conditional UPDATE lets the database arbitrate concurrent reviewers.
    // Its trigger advances updated_at even when the selected status is unchanged.
    const result = await clients.serviceClient.from("contact_messages")
      .update({ status: body.status })
      .eq("id", body.id).eq("updated_at", body.updatedAt)
      .select(contactInboxSelect).abortSignal(AbortSignal.timeout(8_000)).retry(false).maybeSingle();
    if (result.error) return failure("The message could not be updated.", 503);
    if (!result.data) return failure("This message changed. Refresh the inbox and try again.", 409);
    const message = contactInboxMessageFromRow(result.data);
    if (!message) return failure("The saved message could not be loaded.", 503);
    return NextResponse.json({ ok: true, message });
  } catch {
    return failure("The contact inbox is temporarily unavailable.", 503);
  }
}

async function loadCounts(client: SupabaseClient): Promise<ContactInboxCounts | null> {
  const results = await Promise.all(CONTACT_INBOX_STATUSES.map((status) =>
    client.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", status)
      .abortSignal(AbortSignal.timeout(8_000)).retry(false)));
  if (results.some((result) => result.error || result.count === null)) return null;
  const counts: ContactInboxCounts = { all: 0, unread: 0, read: 0, archived: 0 };
  CONTACT_INBOX_STATUSES.forEach((status, index) => {
    counts[status] = results[index].count!;
    counts.all += counts[status];
  });
  return counts;
}

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function inboxRateLimit(action: string, userId: string, maximum: number) {
  const result = consumeRequestRateLimit(`contact-inbox:${action}:${userId}`, maximum, 10 * 60 * 1_000);
  return result.allowed ? null : NextResponse.json(
    { ok: false, error: "Too many inbox requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
