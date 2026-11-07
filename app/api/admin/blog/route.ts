import type { NextRequest } from "next/server";
import { BLOG_DOCUMENT_MAX_BYTES, validateBlogDocument } from "../../../lib/blog";
import { blogAdminClients, blogFailure, blogPostFromRow, blogRateLimit, blogSelect } from "../../../lib/blogServer";
import { privateNextResponse as NextResponse } from "../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const clients = await blogAdminClients(request);
    if ("error" in clients) return blogFailure(clients.error, clients.status);
    const limited = blogRateLimit("list", clients.adminUser.id, 180);
    if (limited) return limited;
    const result = await clients.serviceClient.from("blog_posts").select(blogSelect)
      .order("updated_at", { ascending: false }).limit(1000).abortSignal(AbortSignal.timeout(8_000)).retry(false);
    if (result.error || !Array.isArray(result.data)) return blogFailure("Blog articles could not be loaded.", 503);
    const posts = result.data.map((row) => blogPostFromRow(row));
    if (posts.some((post) => !post)) return blogFailure("Blog articles could not be loaded.", 503);
    return NextResponse.json({ ok: true, posts });
  } catch { return blogFailure("Blog management is temporarily unavailable.", 503); }
}
export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return blogFailure("This request is not allowed.", 403);
  try {
    const clients = await blogAdminClients(request);
    if ("error" in clients) return blogFailure(clients.error, clients.status);
    const limited = blogRateLimit("create", clients.adminUser.id, 60);
    if (limited) return limited;
    const parsed = await readLimitedJsonObjectDetailed(request, BLOG_DOCUMENT_MAX_BYTES);
    if (!parsed.ok) return blogFailure("Invalid blog document.", parsed.error === "too-large" ? 413 : parsed.error === "content-type" ? 415 : 400);
    if (Object.keys(parsed.value).some((key) => key !== "document")) return blogFailure("Invalid create request.", 400);
    const valid = validateBlogDocument(parsed.value.document);
    if (!valid.ok) return blogFailure(valid.error, 400);
    const result = await clients.serviceClient.from("blog_posts").insert({ slug: valid.document.slug,
      draft: valid.document, created_by: clients.adminUser.id, updated_by: clients.adminUser.id })
      .select(blogSelect).abortSignal(AbortSignal.timeout(8_000)).retry(false).single();
    if (result.error?.code === "23505") return blogFailure("This URL slug is already in use. Choose another.", 409);
    if (result.error) return blogFailure("The draft could not be created.", 503);
    const post = blogPostFromRow(result.data);
    if (!post) return blogFailure("The saved draft could not be loaded.", 503);
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch { return blogFailure("Blog management is temporarily unavailable.", 503); }
}
