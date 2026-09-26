import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { authenticateActiveBearer } from "./activeBearerServer";
import { isCanonicalUuid } from "./activeBearerClaims";
import { hasExpectedRasterSignature } from "./imageSafetyServer";
import { privateNextResponse } from "./privateApiResponse";
import { consumeRequestRateLimit } from "./requestRateLimitServer";
import { resolveSupabaseUrl } from "./supabaseConfig";
import {
  isYachtPhotoPath,
  maximumYachtPhotoBytes,
  parseYachtWorkspaceDetails,
  yachtPhotoMimeTypes,
  type YachtWorkspaceCard,
} from "./yachtWorkspace";
import { readYachtWorkspaceForm, YachtWorkspaceRequestError } from "./yachtWorkspaceRequest";

const yachtPhotoBucket = "yacht-photos";
const yachtColumns = "id,owner_id,name,yacht_type,model,crew_size,flag,photo_path";
type YachtRow = {
  id: string; owner_id: string; name: string | null; yacht_type: YachtWorkspaceCard["yachtType"];
  model: string | null; crew_size: number | null; flag: string | null; photo_path: string | null;
};

export async function getYachtWorkspace(request: Request) {
  const auth = await yachtClients(request);
  if ("response" in auth) return auth.response;
  const limit = consumeRequestRateLimit(`yacht-workspace:read:${auth.userId}`, 120, 10 * 60_000);
  if (!limit.allowed) return failure("Please wait before refreshing your yachts again.", 429, "rate_limited", { "Retry-After": String(limit.retryAfterSeconds) });
  const { data, error } = await auth.client.from("yachts").select(yachtColumns)
    .eq("owner_id", auth.userId).order("created_at", { ascending: false }).limit(25);
  if (error) return databaseFailure(error);
  const yachts = await yachtCards(auth.service, (data || []) as YachtRow[]);
  return privateNextResponse.json({ yachts });
}

export async function saveYachtWorkspace(request: Request, yachtId?: string) {
  if (yachtId && !isCanonicalUuid(yachtId)) return failure("Yacht not found.", 404, "not_found");
  const auth = await yachtClients(request);
  if ("response" in auth) return auth.response;
  const limit = consumeRequestRateLimit(`yacht-workspace:write:${auth.userId}`, 30, 10 * 60_000);
  if (!limit.allowed) return failure("Please wait before updating your yacht again.", 429, "rate_limited", { "Retry-After": String(limit.retryAfterSeconds) });

  let existing: YachtRow | null = null;
  if (yachtId) {
    const result = await auth.client.from("yachts").select(yachtColumns)
      .eq("id", yachtId).eq("owner_id", auth.userId).maybeSingle();
    if (result.error) return databaseFailure(result.error);
    if (!result.data) return failure("Yacht not found.", 404, "not_found");
    existing = result.data as YachtRow;
  }

  let uploadedPath: string | null = null;
  let saved = false;
  try {
    const form = await readYachtWorkspaceForm(request);
    const details = parseYachtWorkspaceDetails(Object.fromEntries(form), existing?.flag);
    if (!details.ok) return failure(details.error, 400, details.code);
    const photoEntry = form.get("photo");
    const removePhoto = form.get("removePhoto") === "true";
    if (photoEntry !== null && !(photoEntry instanceof File)) {
      return failure("Choose an image file for the yacht photo.", 400, "invalid_photo");
    }
    if (photoEntry && removePhoto) return failure("Choose a replacement photo or remove the existing photo.", 400, "invalid_photo");
    const photo = photoEntry ? await readYachtPhoto(photoEntry) : null;
    const id = yachtId || crypto.randomUUID();
    if (photo) {
      uploadedPath = `${auth.userId}/${id}/${crypto.randomUUID()}.${photo.extension}`;
      const upload = await auth.service.storage.from(yachtPhotoBucket).upload(uploadedPath, photo.bytes, {
        contentType: photo.contentType, upsert: false, cacheControl: "3600",
      });
      if (upload.error) {
        logFailure("photo_upload_failed", upload.error);
        throw new YachtWorkspaceRequestError("The photo could not be uploaded. Please try again.", 502, "photo_upload_failed");
      }
    }
    const fields = {
      name: details.value.name, yacht_type: details.value.yachtType,
      model: details.value.model, crew_size: details.value.crewSize, flag: details.value.flag,
      photo_path: uploadedPath || (removePhoto ? null : existing?.photo_path || null),
    };
    let result;
    if (existing) {
      // A changed photo path means another tab saved this yacht while this
      // request uploaded. Do not replace/delete the newer photo in that case.
      let query = auth.client.from("yachts").update(fields)
        .eq("id", existing.id).eq("owner_id", auth.userId);
      query = existing.photo_path === null
        ? query.is("photo_path", null)
        : query.eq("photo_path", existing.photo_path);
      result = await query.select(yachtColumns).maybeSingle();
    } else {
      result = await auth.client.from("yachts").insert({ ...fields, id, owner_id: auth.userId })
        .select(yachtColumns).single();
    }
    if (result.error) return databaseFailure(result.error);
    if (!result.data) return failure("This yacht was updated elsewhere. Reload it and try again.", 409, "yacht_changed");
    saved = true;
    if (existing?.photo_path && existing.photo_path !== fields.photo_path && isYachtPhotoPath(existing.photo_path, auth.userId, id)) {
      await removeYachtPhoto(auth.service, existing.photo_path);
    }
    const [yacht] = await yachtCards(auth.service, [result.data as YachtRow]);
    return privateNextResponse.json({ yacht }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof YachtWorkspaceRequestError) return failure(error.message, error.status, error.code);
    logFailure("yacht_save_failed", error);
    return failure("Your yacht could not be saved. Please try again.", 500, "save_failed");
  } finally {
    // Never leave a failed insert/update's newly uploaded photo attached to
    // another yacht, and never remove the old photo until persistence succeeds.
    if (uploadedPath && !saved) await removeYachtPhoto(auth.service, uploadedPath);
  }
}

async function yachtClients(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { response: failure("Login session is required.", 401, "login_required") };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return { response: failure("Yacht workspace is temporarily unavailable.", 503, "unavailable") };
  const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const authClient = createClient(resolveSupabaseUrl(url), anonKey, authOptions);
  const service = createClient(resolveSupabaseUrl(url), serviceKey, authOptions);
  const result = await authenticateActiveBearer({ token, authClient, serviceClient: service });
  if (!result.ok) return { response: failure(result.error, result.status, result.reason) };
  // Use the user's bearer for row reads/writes: owner filtering and existing
  // RLS both apply. The service key is limited here to session checks/storage.
  const client = createClient(resolveSupabaseUrl(url), anonKey, {
    ...authOptions, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { client, service, userId: result.user.id };
}

async function yachtCards(service: SupabaseClient, rows: YachtRow[]): Promise<YachtWorkspaceCard[]> {
  const paths = rows.filter((row) => isYachtPhotoPath(row.photo_path, row.owner_id, row.id)).map((row) => row.photo_path!);
  const signed = paths.length ? await service.storage.from(yachtPhotoBucket).createSignedUrls(paths, 3600) : null;
  if (signed?.error) logFailure("photo_sign_failed", signed.error);
  const photoUrls = new Map((signed?.data || []).map((value) => [value.path, value.signedUrl]));
  return rows.map((row) => ({
    id: row.id, name: row.name || "", yachtType: row.yacht_type || null,
    model: row.model || null, crewSize: row.crew_size ?? null, flag: row.flag || null,
    photoUrl: isYachtPhotoPath(row.photo_path, row.owner_id, row.id) ? photoUrls.get(row.photo_path) || null : null,
  }));
}

export async function readYachtPhoto(file: File) {
  const contentType = file.type.toLowerCase();
  if (!(yachtPhotoMimeTypes as readonly string[]).includes(contentType) || file.size <= 0) {
    throw new YachtWorkspaceRequestError("Use a JPG, PNG, WebP or AVIF photo.", 415, "invalid_photo_type");
  }
  if (file.size > maximumYachtPhotoBytes) throw new YachtWorkspaceRequestError("The photo must be 4 MB or smaller.", 413, "photo_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength < 32 || !hasExpectedRasterSignature(bytes, contentType)) {
    throw new YachtWorkspaceRequestError("This file is not a valid image. Choose another photo.", 415, "invalid_photo_data");
  }
  try {
    // Decode the full raster, reject corrupt/oversized inputs, normalize EXIF
    // orientation, then store a compact image without source metadata.
    const normalized = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning", animated: false })
      .rotate()
      .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    if (normalized.byteLength > maximumYachtPhotoBytes) {
      throw new Error("Normalized photo exceeds size limit");
    }
    return { bytes: normalized, contentType: "image/webp", extension: "webp" };
  } catch {
    throw new YachtWorkspaceRequestError("This file is not a valid image. Choose another photo.", 415, "invalid_photo_data");
  }
}

async function removeYachtPhoto(service: SupabaseClient, path: string) {
  try {
    const { error } = await service.storage.from(yachtPhotoBucket).remove([path]);
    if (error) logFailure("photo_cleanup_failed", error);
  } catch (error) {
    logFailure("photo_cleanup_failed", error);
  }
}

function databaseFailure(error: { code?: string }) {
  logFailure("yacht_database_failed", error);
  if (error.code === "54000") return failure("You can add up to 25 yachts to your workspace.", 409, "yacht_limit");
  if (error.code === "42501") return failure("You do not have permission to change this yacht.", 403, "forbidden");
  return failure("Your yacht workspace could not be updated. Please try again.", 503, "unavailable");
}

function failure(error: string, status: number, code: string, headers?: HeadersInit) {
  return privateNextResponse.json({ error, code }, { status, headers });
}

function logFailure(event: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code).slice(0,40) : undefined;
  console.error("[yacht-workspace]", { event, code });
}
