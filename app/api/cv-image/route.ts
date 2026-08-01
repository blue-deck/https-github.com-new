const maxImageBytes = 24 * 1024 * 1024;
const maxSourceLength = 8_192;
const sourceTimeoutMilliseconds = 8_000;
const allowedSourceContentTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);
const allowedQueryParameters = new Set(["fit", "h", "max", "src", "url", "w"]);
const allowedImageFits = new Set(["contain", "cover", "inside"]);
const allowedSameOriginStaticPaths = new Set([
  "/bluedeck-logo-wide-premium-transparent.png",
]);
const uuidPathSegment =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const employerMediaPathPattern = new RegExp(
  `^/api/employer/job-posts/${uuidPathSegment}/applications/${uuidPathSegment}/media$`,
  "i",
);
const findCrewMediaPathPattern = /^\/api\/find-crew\/[A-Z0-9_-]{1,64}\/media$/i;
const privateResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "same-origin",
  Expires: "0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawSource = getValidatedSource(requestUrl.searchParams);
  if (!rawSource) {
    return privateTextResponse("Invalid image request", 400);
  }

  let imageUrl: URL;
  try {
    imageUrl = rawSource.startsWith("/")
      ? new URL(rawSource, requestUrl.origin)
      : new URL(rawSource);
  } catch {
    return privateTextResponse("Invalid image source", 400);
  }

  if (
    !["http:", "https:"].includes(imageUrl.protocol) ||
    imageUrl.username ||
    imageUrl.password ||
    imageUrl.hash
  ) {
    return privateTextResponse("Unsupported image source", 400);
  }

  if (!isAllowedCvImageSource(imageUrl, requestUrl)) {
    return privateTextResponse("Image source is not allowed", 403);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sourceTimeoutMilliseconds);

  try {
    const response = await fetch(imageUrl, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return privateTextResponse("Image redirects are not allowed", 403);
    }

    if (!response.ok) {
      return privateTextResponse("Image could not be loaded", response.status);
    }

    const contentType = (response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!allowedSourceContentTypes.has(contentType)) {
      return privateTextResponse("Unsupported image type", 415);
    }

    const declaredContentLength = parseDeclaredContentLength(
      response.headers.get("content-length"),
    );
    if (declaredContentLength === "invalid") {
      return privateTextResponse("Invalid image response", 502);
    }
    if (declaredContentLength !== null && declaredContentLength > maxImageBytes) {
      return privateTextResponse("Image is too large", 413);
    }

    const imageBytes = await readLimitedImageBody(response);
    return new Response(imageBytes, {
      headers: {
        ...privateResponseHeaders,
        "Content-Length": String(imageBytes.byteLength),
        "Content-Type": contentType,
        Vary: "Accept",
      },
    });
  } catch (error) {
    if (error instanceof ImageTooLargeError) {
      return privateTextResponse("Image is too large", 413);
    }

    return privateTextResponse("Image request failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function getValidatedSource(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (!allowedQueryParameters.has(key)) return null;
  }

  const sources = [...searchParams.getAll("src"), ...searchParams.getAll("url")];
  if (sources.length !== 1) return null;

  const source = sources[0];
  if (
    !source ||
    source.length > maxSourceLength ||
    /[\u0000-\u001f\u007f]/.test(source)
  ) {
    return null;
  }

  for (const parameter of ["w", "h", "max"]) {
    const values = searchParams.getAll(parameter);
    if (values.length > 1) return null;
    if (values.length === 1 && !isValidImageDimension(values[0])) return null;
  }

  const fits = searchParams.getAll("fit");
  if (fits.length > 1 || (fits.length === 1 && !allowedImageFits.has(fits[0]))) {
    return null;
  }

  return source;
}

function isValidImageDimension(value: string) {
  if (!/^\d{1,4}$/.test(value)) return false;
  const dimension = Number(value);
  return dimension >= 32 && dimension <= 2_400;
}

function isAllowedCvImageSource(imageUrl: URL, requestUrl: URL) {
  if (imageUrl.origin === requestUrl.origin) {
    return isAllowedSameOriginMediaPath(imageUrl);
  }

  return isAllowedConfiguredSupabaseStorageObject(imageUrl);
}

function isAllowedSameOriginMediaPath(imageUrl: URL) {
  if (/^\/api\/cv-image\/?$/.test(imageUrl.pathname)) return false;

  if (allowedSameOriginStaticPaths.has(imageUrl.pathname)) {
    return imageUrl.search === "";
  }

  return (
    findCrewMediaPathPattern.test(imageUrl.pathname) ||
    employerMediaPathPattern.test(imageUrl.pathname)
  );
}

function isAllowedConfiguredSupabaseStorageObject(imageUrl: URL) {
  const supabaseOrigin = getConfiguredSupabaseOrigin();
  if (!supabaseOrigin || imageUrl.origin !== supabaseOrigin) return false;

  const pathMatch = imageUrl.pathname.match(
    /^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/,
  );
  if (!pathMatch) return false;

  const [, , encodedBucket, encodedObjectPath] = pathMatch;
  const bucket = safelyDecodePathSegment(encodedBucket);
  if (!bucket || !/^[A-Z0-9][A-Z0-9._-]{0,127}$/i.test(bucket)) return false;

  return encodedObjectPath
    .split("/")
    .every((segment) => safelyDecodePathSegment(segment) !== null);
}

function getConfiguredSupabaseOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return null;

  try {
    const parsedUrl = new URL(configuredUrl);
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      return null;
    }

    return parsedUrl.origin;
  } catch {
    return null;
  }
}

function safelyDecodePathSegment(segment: string) {
  if (!segment) return null;

  try {
    const decoded = decodeURIComponent(segment);
    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      /[\\/\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function parseDeclaredContentLength(value: string | null): number | null | "invalid" {
  if (value === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) return "invalid";

  const length = Number(value);
  return Number.isSafeInteger(length) ? length : "invalid";
}

async function readLimitedImageBody(response: Response) {
  if (!response.body) throw new Error("Image response body is missing");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      byteLength += value.byteLength;
      if (byteLength > maxImageBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size check has already failed; cancellation is best-effort.
        }
        throw new ImageTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (byteLength === 0) throw new Error("Image response body is empty");

  const imageBytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    imageBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return imageBytes;
}

function privateTextResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      ...privateResponseHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

class ImageTooLargeError extends Error {}
