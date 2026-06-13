import { existsSync } from "node:fs";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxHtmlBytes = 8 * 1024 * 1024;
const maxCssBytes = 750 * 1024;

type CvPdfRequest = {
  html: string;
  css: string;
  fileName: string;
};

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);

  try {
    if (!isSameOriginRequest(request, requestUrl)) {
      return new Response("Invalid CV PDF origin.", { status: 403 });
    }

    const payload = await readCvPdfRequest(request);
    const sizeError = validatePayloadSize(payload);
    if (sizeError) return sizeError;

    const browser = await launchBrowser();
    let pdf: Uint8Array;

    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (resourceRequest) => {
        if (isAllowedPdfResource(resourceRequest.url(), requestUrl)) {
          resourceRequest.continue();
          return;
        }
        resourceRequest.abort();
      });

      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(buildPdfDocument(payload, requestUrl), {
        waitUntil: ["domcontentloaded", "load"],
        timeout: 45000,
      });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => undefined);
      await page.emulateMediaType("print");

      pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        timeout: 45000,
      });
    } finally {
      await browser.close();
    }

    const pdfBody = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(pdfBody, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": contentDispositionHeader(payload.fileName),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("BlueDeck CV PDF generation failed", error);
    return new Response("CV PDF could not be generated.", { status: 500 });
  }
}

function isSameOriginRequest(request: Request, requestUrl: URL) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

async function readCvPdfRequest(request: Request): Promise<CvPdfRequest> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return normalizePayload(body);
  }

  const formData = await request.formData();
  return normalizePayload({
    html: formData.get("html"),
    css: formData.get("css"),
    fileName: formData.get("fileName"),
  });
}

function normalizePayload(value: unknown): CvPdfRequest {
  const body = value as Partial<Record<keyof CvPdfRequest, unknown>>;
  return {
    html: typeof body.html === "string" ? body.html : "",
    css: typeof body.css === "string" ? body.css : "",
    fileName: typeof body.fileName === "string" ? body.fileName : "BlueDeck Crew - CV.pdf",
  };
}

function validatePayloadSize(payload: CvPdfRequest) {
  if (!payload.html.trim() || !payload.css.trim()) {
    return new Response("Missing CV PDF payload.", { status: 400 });
  }

  if (new TextEncoder().encode(payload.html).byteLength > maxHtmlBytes) {
    return new Response("CV HTML payload is too large.", { status: 413 });
  }

  if (new TextEncoder().encode(payload.css).byteLength > maxCssBytes) {
    return new Response("CV CSS payload is too large.", { status: 413 });
  }

  return null;
}

async function launchBrowser() {
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);
  const executablePath = await chromiumExecutablePath(chromium);

  return puppeteer.launch({
    args: [
      ...chromium.args,
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
      "--no-zygote",
      "--single-process",
    ],
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
  });
}

async function chromiumExecutablePath(chromium: { executablePath: () => Promise<string> }) {
  if (process.env.CHROME_EXECUTABLE_PATH && existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const localPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  const localPath = localPaths.find((path) => existsSync(path));
  if (localPath) return localPath;

  return chromium.executablePath();
}

function buildPdfDocument(payload: CvPdfRequest, requestUrl: URL) {
  const html = sanitizeHtml(payload.html);
  const css = sanitizeCss(payload.css);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data: blob:; style-src 'unsafe-inline'; font-src 'self' data: https:;" />
    <base href="${escapeHtml(`${requestUrl.origin}/`)}" />
    <style>${css}</style>
  </head>
  <body>${html}</body>
</html>`;
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function sanitizeCss(css: string) {
  return css
    .replace(/\b(?:oklab|oklch|lab|lch|hwb|color)\([^;{}]*\)/gi, "#242a31")
    .replace(/\bcolor-mix\([^;{}]*\)/gi, "#ffffff")
    .replace(/@import[^;]+;/gi, "");
}

function isAllowedPdfResource(resourceUrl: string, requestUrl: URL) {
  if (resourceUrl === "about:blank" || resourceUrl.startsWith("data:") || resourceUrl.startsWith("blob:")) return true;

  let parsed: URL;
  try {
    parsed = new URL(resourceUrl);
  } catch {
    return false;
  }

  if (parsed.origin === requestUrl.origin) return true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  try {
    return parsed.hostname === new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
}

function contentDispositionHeader(fileName: string) {
  const safeName = sanitizeFileName(fileName || "BlueDeck Crew - CV.pdf");
  const encoded = encodeURIComponent(safeName).replace(/['()]/g, escape).replace(/\*/g, "%2A");
  return `attachment; filename="${safeName.replace(/"/g, "'")}"; filename*=UTF-8''${encoded}`;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed || "BlueDeck Crew - CV"}.pdf`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
