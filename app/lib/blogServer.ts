import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { contactInboxClients } from "./contactInboxServer";
import { isRecord } from "./employerAccessServer";
import { resolveSupabaseUrl } from "./supabaseConfig";
import { validateBlogDocument, type BlogPost } from "./blog";
import { privateNextResponse } from "./privateApiResponse";
import { consumeRequestRateLimit } from "./requestRateLimitServer";

export const blogSelect = "id,slug,status,draft,published,published_at,published_updated_at,created_at,updated_at,version";
const publicSelect = "id,slug,status,published,published_at,published_updated_at,created_at,version";
export async function blogAdminClients(request: NextRequest) {
  const clients = await contactInboxClients(request);
  if ("error" in clients) return { ...clients, error: clients.status === 403 ? "Blog administration is restricted to the site owner." : clients.error };
  return clients;
}
export function blogPostFromRow(value: unknown, publicOnly = false): BlogPost | null {
  if (!isRecord(value) || typeof value.id !== "string" || !["draft", "published", "archived"].includes(String(value.status)) ||
      typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 1 ||
      typeof value.created_at !== "string") return null;
  const draft = validateBlogDocument(publicOnly ? value.published : value.draft);
  const published = value.published ? validateBlogDocument(value.published, true) : null;
  if (!draft.ok || (published && !published.ok)) return null;
  return { id: value.id, status: value.status as BlogPost["status"], draft: draft.document,
    published: published?.ok ? published.document : null,
    publishedAt: typeof value.published_at === "string" ? value.published_at : null,
    publishedUpdatedAt: typeof value.published_updated_at === "string" ? value.published_updated_at : null,
    createdAt: value.created_at,
    updatedAt: publicOnly ? String(value.published_updated_at ?? value.created_at) : String(value.updated_at), version: value.version };
}
function publicClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Blog storage is unavailable.");
  return createClient(resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
// React cache only deduplicates within this render; it never retains a stale publication.
export const getPublishedBlogPosts = cache(async (): Promise<BlogPost[]> => {
  const result = await publicClient().from("blog_posts").select(publicSelect).eq("status", "published")
    .order("published_at", { ascending: false }).order("id", { ascending: false })
    .limit(1000).abortSignal(AbortSignal.timeout(8_000)).retry(false);
  if (result.error || !Array.isArray(result.data)) throw new Error("Blog articles could not be loaded.");
  const posts = result.data.map((row) => blogPostFromRow(row, true));
  if (posts.some((post) => !post)) throw new Error("Blog articles could not be loaded.");
  return posts as BlogPost[];
});
export const getPublishedBlogPost = cache(async (slug: string): Promise<BlogPost | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return null;
  const result = await publicClient().from("blog_posts").select(publicSelect).eq("status", "published").eq("slug", slug)
    .abortSignal(AbortSignal.timeout(8_000)).retry(false).maybeSingle();
  if (result.error) throw new Error("The blog article could not be loaded.");
  if (!result.data) return null;
  const post = blogPostFromRow(result.data, true);
  if (!post) throw new Error("The blog article could not be loaded.");
  return post;
});
export function blogFailure(error: string, status: number) {
  return privateNextResponse.json({ ok: false, error }, { status });
}
export function blogRateLimit(action: string, userId: string, maximum = 120) {
  const result = consumeRequestRateLimit(`blog:${action}:${userId}`, maximum, 10 * 60 * 1000);
  return result.allowed ? null : privateNextResponse.json({ ok: false, error: "Too many blog requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
}
export function refreshBlogPages(slug: string) {
  try {
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    revalidatePath("/sitemap.xml");
  } catch {
    // Publications are already committed. Dynamic readers still fetch fresh rows.
    console.error("[blog] publication cache refresh unavailable");
  }
}
