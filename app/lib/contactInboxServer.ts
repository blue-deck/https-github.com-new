import "server-only";

import type { NextRequest } from "next/server";
import {
  adminEmployerClients,
  isRecord,
  isUuid,
} from "./employerAccessServer";
import {
  isContactInboxStatus,
  type ContactInboxFilter,
  type ContactInboxMessage,
} from "./contactInbox";

// This address is deliberately server-only. Dashboard visibility is not authorization.
const contactInboxOwnerEmail = "uymaxsinan@gmail.com";
export const contactInboxSelect =
  "id,created_at,updated_at,name,email,topic,message,language,status";
export const contactInboxPageSize = 50;

type ContactInboxCursor = { createdAt: string; id: string };

export async function contactInboxClients(request: NextRequest) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clients = await Promise.race([
    adminEmployerClients(request),
    new Promise<{ error: string; status: number }>((resolve) => {
      timer = setTimeout(() => resolve({ error: "Contact inbox access could not be verified.", status: 503 }), 12_000);
    }),
  ]).finally(() => clearTimeout(timer));
  if ("error" in clients) return clients;
  if (clients.adminUser.email?.trim().toLowerCase() !== contactInboxOwnerEmail) {
    return { error: "Contact inbox access is restricted.", status: 403 };
  }
  return clients;
}

/** Keep Postgres microseconds intact for pagination and optimistic updates. */
export function isContactInboxTimestamp(value: unknown): value is string {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) return false;
  const wallClock = new Date(`${value.slice(0, 19)}Z`);
  return Number.isFinite(wallClock.getTime()) && wallClock.toISOString().slice(0, 19) === value.slice(0, 19);
}

export function contactInboxMessageFromRow(value: unknown): ContactInboxMessage | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isUuid(value.id) ||
      !isContactInboxTimestamp(value.created_at) || !isContactInboxTimestamp(value.updated_at) ||
      typeof value.name !== "string" || !value.name.trim() || value.name.length > 120 ||
      typeof value.email !== "string" || !value.email.trim() || value.email.length > 254 ||
      typeof value.message !== "string" || !value.message.trim() || value.message.length > 2000 ||
      (value.topic !== "account" && value.topic !== "recruitment" && value.topic !== "yacht-os" && value.topic !== "general") ||
      (value.language !== "en" && value.language !== "tr") || !isContactInboxStatus(value.status)) {
    return null;
  }
  return {
    id: value.id, createdAt: value.created_at, updatedAt: value.updated_at,
    name: value.name, email: value.email, topic: value.topic, message: value.message,
    language: value.language, status: value.status,
  };
}

export function encodeContactInboxCursor(cursor: ContactInboxCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function parseContactInboxQuery(parameters: URLSearchParams) {
  if (Array.from(parameters.keys()).some((key) => key !== "status" && key !== "cursor") ||
      parameters.getAll("status").length > 1 || parameters.getAll("cursor").length > 1) {
    return null;
  }
  const status = parameters.get("status") ?? "unread";
  if (status !== "all" && !isContactInboxStatus(status)) return null;
  const rawCursor = parameters.get("cursor");
  let cursor: ContactInboxCursor | null = null;
  if (rawCursor !== null) {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(rawCursor)) return null;
    try {
      const value: unknown = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (!isRecord(value) || Object.keys(value).length !== 2 ||
          typeof value.id !== "string" || !isUuid(value.id) || !isContactInboxTimestamp(value.createdAt)) return null;
      cursor = { createdAt: value.createdAt, id: value.id };
    } catch { return null; }
  }
  return { status: status as ContactInboxFilter, cursor };
}
