import type { NextRequest } from "next/server";
import { BLOG_DOCUMENT_MAX_BYTES, validateBlogDocument } from "../../../../lib/blog";
import { blogAdminClients, blogFailure, blogPostFromRow, blogRateLimit, blogSelect, refreshBlogPages } from "../../../../lib/blogServer";
import { isUuid } from "../../../../lib/employerAccessServer";
import { privateNextResponse as NextResponse } from "../../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../../../lib/requestOriginServer";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: Context) {
  if (!isTrustedSameOriginMutation(request)) return blogFailure("This request is not allowed.", 403);
  try {
    const clients = await blogAdminClients(request);
    if ("error" in clients) return blogFailure(clients.error, clients.status);
    const limited = blogRateLimit("update", clients.adminUser.id);
    if (limited) return limited;
    const { id } = await context.params;
    if (!isUuid(id)) return blogFailure("Invalid article.", 400);
    const parsed = await readLimitedJsonObjectDetailed(request, BLOG_DOCUMENT_MAX_BYTES);
    if (!parsed.ok) return blogFailure("Invalid blog update.", parsed.error === "too-large" ? 413 : parsed.error === "content-type" ? 415 : 400);
    const body = parsed.value;
    if (Object.keys(body).some((key) => !["version", "action", "document"].includes(key)) || !Number.isSafeInteger(body.version) || Number(body.version) < 1 ||
        !["save", "publish", "unpublish", "archive", "restore"].includes(String(body.action))) return blogFailure("Invalid blog update.", 400);
    const result = await clients.serviceClient.from("blog_posts").select(blogSelect).eq("id", id)
      .abortSignal(AbortSignal.timeout(8_000)).retry(false).maybeSingle();
    if (result.error) return blogFailure("The article could not be loaded.", 503);
    const current = blogPostFromRow(result.data);
    if (!current) return blogFailure("This article no longer exists.", 404);
    if (current.version !== body.version) return blogFailure("This article changed in another session. Reload before saving.", 409);
    const action = body.action;
    if (body.document !== undefined && action !== "save" && action !== "publish") return blogFailure("This action does not accept article content.", 400);
    if ((action === "save" || action === "publish") && current.status === "archived") return blogFailure("Restore this article before editing or publishing.", 409);
    if (action === "restore" && current.status !== "archived") return blogFailure("Only archived articles can be restored.", 409);
    if (action === "unpublish" && current.status !== "published") return blogFailure("This article is not currently published.", 409);
    const valid = validateBlogDocument(body.document ?? current.draft, action === "publish");
    if (!valid.ok) return blogFailure(valid.error, 400);
    if (current.publishedAt && valid.document.slug !== current.draft.slug) return blogFailure("The URL of a previously published article cannot be changed.", 400);
    const update: Record<string, unknown> = { updated_by: clients.adminUser.id };
    if (action === "save" || action === "publish") { update.draft = valid.document; update.slug = valid.document.slug; }
    if (action === "publish") {
      update.status = "published"; update.published = valid.document;
      update.published_at = current.publishedAt ?? new Date().toISOString();
      update.published_updated_at = new Date().toISOString();
    }
    if (action === "unpublish" || action === "restore") update.status = "draft";
    if (action === "archive") update.status = "archived";
    const saved = await clients.serviceClient.from("blog_posts").update(update).eq("id", id).eq("version", body.version)
      .select(blogSelect).abortSignal(AbortSignal.timeout(8_000)).retry(false).maybeSingle();
    if (saved.error?.code === "23505") return blogFailure("This URL slug is already in use. Choose another.", 409);
    if (saved.error) return blogFailure("The article could not be saved.", 503);
    if (!saved.data) return blogFailure("This article changed in another session. Reload before saving.", 409);
    const post = blogPostFromRow(saved.data);
    if (!post) return blogFailure("The saved article could not be loaded.", 503);
    if (action !== "save") refreshBlogPages(post.draft.slug);
    return NextResponse.json({ ok: true, post });
  } catch { return blogFailure("Blog management is temporarily unavailable.", 503); }
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!isTrustedSameOriginMutation(request)) return blogFailure("This request is not allowed.", 403);
  try {
    const clients = await blogAdminClients(request);
    if ("error" in clients) return blogFailure(clients.error, clients.status);
    const limited = blogRateLimit("delete", clients.adminUser.id, 30);
    if (limited) return limited;
    const { id } = await context.params;
    if (!isUuid(id)) return blogFailure("Invalid article.", 400);
    const parsed = await readLimitedJsonObjectDetailed(request, 256);
    if (!parsed.ok || Object.keys(parsed.value).length !== 1 || !Number.isSafeInteger(parsed.value.version) || Number(parsed.value.version) < 1) return blogFailure("Invalid delete request.", 400);
    // The condition is atomic: a concurrent publication can never be deleted.
    const result = await clients.serviceClient.from("blog_posts").delete().eq("id", id).eq("version", parsed.value.version)
      .neq("status", "published").select("id,slug").abortSignal(AbortSignal.timeout(8_000)).retry(false).maybeSingle();
    if (result.error) return blogFailure("The article could not be deleted.", 503);
    if (!result.data) return blogFailure("Unpublish this article first, or reload if it changed in another session.", 409);
    refreshBlogPages(result.data.slug);
    return NextResponse.json({ ok: true });
  } catch { return blogFailure("Blog management is temporarily unavailable.", 503); }
}
