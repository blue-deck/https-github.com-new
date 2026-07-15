"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSafeStoragePath } from "./storage";
import { supabase } from "./supabase";

export const DASHBOARD_PHOTO_EVENT = "bluedeck:dashboard-photo-updated";
export const DASHBOARD_PHOTO_CHANNEL = "bluedeck:dashboard-photo";

const messageVersion = 1 as const;
const maxDashboardPhotoBytes = 10 * 1024 * 1024;
const dashboardPhotoMimeTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type AccountIdentity = {
  userId: string;
  crewProfileId?: string;
  email: string;
  fullName: string;
  role: string;
  profilePhotoUrl: string;
  dashboardPhotoUrl: string;
};

export type DashboardPhotoUpdate = {
  userId: string;
  photoUrl: string;
  crewProfileId?: string;
  email?: string;
  fullName?: string;
  role?: string;
};

export type DashboardPhotoEventDetail = {
  version: typeof messageVersion;
  originId: string;
  updatedAt: number;
  update: DashboardPhotoUpdate;
};

export type SaveDashboardPhotoInput = {
  user: User;
  file: File;
  crewProfileId?: string;
  email?: string;
  fullName?: string;
  client?: SupabaseClient;
};

export type SaveDashboardPhotoResult = {
  photoUrl: string;
  path: string;
  crewProfileId?: string;
  update: DashboardPhotoUpdate;
};

export type RemoveDashboardPhotoInput = {
  user: User;
  fullName?: string;
  client?: SupabaseClient;
};

export type RemoveDashboardPhotoResult = {
  update: DashboardPhotoUpdate;
};

type AccountProfileRow = {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

type CrewProfileRow = {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  profile_photo_url?: string | null;
};

type DashboardPhotoChannelMessage = DashboardPhotoEventDetail;

let broadcastChannel: BroadcastChannel | null = null;
let broadcastSubscriberCount = 0;

const tabOriginId = createOriginId();

export function dashboardPhotoFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallback?: string | null
) {
  if (metadata && Object.prototype.hasOwnProperty.call(metadata, "avatar_url")) {
    return typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";
  }

  return fallback || "";
}

export async function loadAccountIdentity(client: SupabaseClient = supabase) {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const [baseProfileResult, crewProfileResult] = await Promise.all([
    client
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .maybeSingle<AccountProfileRow>(),
    client
      .from("crew_profiles")
      .select("id, email, full_name, profile_photo_url")
      .eq("user_id", user.id)
      .maybeSingle<CrewProfileRow>(),
  ]);

  if (baseProfileResult.error) throw baseProfileResult.error;
  if (crewProfileResult.error) throw crewProfileResult.error;

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const baseProfile = baseProfileResult.data;
  const crewProfile = crewProfileResult.data;
  const email = firstText(baseProfile?.email, crewProfile?.email, user.email);
  const fullName = firstDisplayName(
    baseProfile?.full_name,
    crewProfile?.full_name,
    metadata?.full_name,
    email
  );
  const role = firstText(baseProfile?.role, metadata?.role, "crew");
  const profilePhotoUrl = firstText(crewProfile?.profile_photo_url);

  return {
    userId: user.id,
    crewProfileId: crewProfile?.id,
    email,
    fullName,
    role,
    profilePhotoUrl,
    dashboardPhotoUrl: dashboardPhotoFromMetadata(metadata, profilePhotoUrl),
  } satisfies AccountIdentity;
}

export async function saveDashboardPhoto({
  user,
  file,
  crewProfileId,
  email,
  fullName,
  client = supabase,
}: SaveDashboardPhotoInput): Promise<SaveDashboardPhotoResult> {
  assertBrowserFile(file);
  const currentUser = await assertCurrentUser(client, user.id);

  const path = createSafeStoragePath(user.id, file, "dashboard");
  const storage = client.storage.from("crew-portfolio");
  const { error: uploadError } = await storage.upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const photoUrl = storage.getPublicUrl(path).data.publicUrl;
  const resolvedEmail = firstText(currentUser.email, email);
  const resolvedFullName = firstDisplayName(
    currentUser.user_metadata?.full_name,
    fullName,
    resolvedEmail
  );
  const cleanupPaths = dashboardCleanupPaths(currentUser, user.id);
  const metadataUpdate = compactRecord({
    avatar_url: photoUrl,
    avatar_path: path,
    avatar_cleanup_paths: cleanupPaths.join(","),
  });
  const { error: avatarError } = await client.auth.updateUser({ data: metadataUpdate });

  if (avatarError) {
    const cleanupResult = await storage.remove([path]);

    throw new DashboardPhotoMutationError(avatarError.message, {
      cause: avatarError,
      rollbackError: cleanupResult.error?.message,
    });
  }

  await settleDashboardCleanup(client, cleanupPaths);

  const update: DashboardPhotoUpdate = {
    userId: user.id,
    crewProfileId,
    email: resolvedEmail,
    fullName: resolvedFullName,
    photoUrl,
  };

  publishDashboardPhotoUpdate(update);

  return {
    photoUrl,
    path,
    crewProfileId,
    update,
  };
}

export async function removeDashboardPhoto({
  user,
  fullName,
  client = supabase,
}: RemoveDashboardPhotoInput): Promise<RemoveDashboardPhotoResult> {
  const currentUser = await assertCurrentUser(client, user.id);

  const resolvedFullName = firstDisplayName(
    currentUser.user_metadata?.full_name,
    fullName,
    currentUser.email,
  );
  const cleanupPaths = dashboardCleanupPaths(currentUser, user.id);
  const { error } = await client.auth.updateUser({
    data: compactRecord({
      avatar_url: "",
      avatar_path: "",
      avatar_cleanup_paths: cleanupPaths.join(","),
    }),
  });

  if (error) throw error;

  await settleDashboardCleanup(client, cleanupPaths);

  const update: DashboardPhotoUpdate = {
    userId: user.id,
    email: currentUser.email,
    fullName: resolvedFullName,
    photoUrl: "",
  };

  publishDashboardPhotoUpdate(update);
  return { update };
}

export function publishDashboardPhotoUpdate(
  update: DashboardPhotoUpdate
): DashboardPhotoEventDetail {
  const detail: DashboardPhotoEventDetail = {
    version: messageVersion,
    originId: tabOriginId,
    updatedAt: Date.now(),
    update,
  };

  if (typeof window === "undefined") return detail;

  dispatchDashboardPhotoEvent(detail);
  getBroadcastChannel()?.postMessage(detail satisfies DashboardPhotoChannelMessage);
  return detail;
}

export function subscribeDashboardPhotoUpdates(
  listener: (update: DashboardPhotoUpdate, detail: DashboardPhotoEventDetail) => void,
  options?: { userId?: string }
) {
  if (typeof window === "undefined") return () => undefined;

  broadcastSubscriberCount += 1;
  getBroadcastChannel();

  const handleUpdate = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!isDashboardPhotoEventDetail(detail)) return;
    if (options?.userId && detail.update.userId !== options.userId) return;
    listener(detail.update, detail);
  };

  window.addEventListener(DASHBOARD_PHOTO_EVENT, handleUpdate);

  return () => {
    window.removeEventListener(DASHBOARD_PHOTO_EVENT, handleUpdate);
    broadcastSubscriberCount = Math.max(0, broadcastSubscriberCount - 1);

    if (broadcastSubscriberCount === 0 && broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
  };
}

export class DashboardPhotoMutationError extends Error {
  rollbackError?: string;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      rollbackError?: string;
    }
  ) {
    super(
      options?.rollbackError
        ? `${message} Rollback also failed: ${options.rollbackError}`
        : message,
      options?.cause === undefined ? undefined : { cause: options.cause }
    );
    this.name = "DashboardPhotoMutationError";
    this.rollbackError = options?.rollbackError;
  }
}

async function assertCurrentUser(client: SupabaseClient, expectedUserId: string) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) throw error;
  if (!user || user.id !== expectedUserId) {
    throw new Error("Your session changed. Please sign in again before updating the photo.");
  }

  return user;
}

function getBroadcastChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (broadcastChannel) return broadcastChannel;

  try {
    broadcastChannel = new BroadcastChannel(DASHBOARD_PHOTO_CHANNEL);
  } catch {
    return null;
  }

  broadcastChannel.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (!isDashboardPhotoEventDetail(event.data)) return;
    if (event.data.originId === tabOriginId) return;
    dispatchDashboardPhotoEvent(event.data);
  });

  return broadcastChannel;
}

function dispatchDashboardPhotoEvent(detail: DashboardPhotoEventDetail) {
  window.dispatchEvent(new CustomEvent<DashboardPhotoEventDetail>(DASHBOARD_PHOTO_EVENT, { detail }));
}

function isDashboardPhotoEventDetail(value: unknown): value is DashboardPhotoEventDetail {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DashboardPhotoEventDetail>;
  const update = candidate.update as Partial<DashboardPhotoUpdate> | undefined;

  return (
    candidate.version === messageVersion &&
    typeof candidate.originId === "string" &&
    typeof candidate.updatedAt === "number" &&
    Boolean(update) &&
    typeof update?.userId === "string" &&
    typeof update?.photoUrl === "string"
  );
}

function createOriginId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function firstDisplayName(...values: unknown[]) {
  const fallback = firstText(...values);

  for (const value of values) {
    if (typeof value !== "string") continue;
    const cleanValue = value.trim();
    if (!cleanValue || cleanValue.includes("@")) continue;
    return cleanValue;
  }

  return fallback;
}

function compactRecord(values: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );
}

function assertBrowserFile(file: File) {
  if (!file || typeof file.name !== "string") {
    throw new Error("Please choose a valid photo file.");
  }

  if (!dashboardPhotoMimeTypes.has(file.type.toLocaleLowerCase())) {
    throw new Error("Please choose a JPG, PNG, WebP or AVIF photo.");
  }

  if (file.size > maxDashboardPhotoBytes) {
    throw new Error("Please choose a photo smaller than 10 MB.");
  }
}

function isOwnedDashboardPath(path: string, userId: string) {
  return path.startsWith(`${userId.toLocaleLowerCase()}/dashboard-`);
}

function dashboardCleanupPaths(user: User, userId: string) {
  const pendingPaths = firstText(user.user_metadata?.avatar_cleanup_paths)
    .split(",")
    .map((path) => path.trim());
  const currentPath = firstText(user.user_metadata?.avatar_path);

  return Array.from(new Set([currentPath, ...pendingPaths])).filter(
    (path) => path && isOwnedDashboardPath(path, userId),
  );
}

async function settleDashboardCleanup(client: SupabaseClient, paths: string[]) {
  if (!paths.length) return;

  const { error } = await client.storage.from("crew-portfolio").remove(paths);
  if (error) return;

  await client.auth.updateUser({ data: { avatar_cleanup_paths: "" } });
}
