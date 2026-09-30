import { assertCvPdfActive, awaitCvPdf } from "./cvPdfAsync";
import { cvPdfCoverRect } from "./cvPdfImageGeometry";
import type { jsPDF } from "jspdf";

type CvPdfDownloadInput = {
  pages: HTMLElement[];
  fileName: string;
  title: string;
  author: string;
  signal: AbortSignal;
  onPage?: (page: number, total: number) => void;
};

export async function downloadCvPages({ pages, fileName, title, author, signal, onPage }: CvPdfDownloadInput) {
  assertCvPdfActive(signal);
  const [{ default: html2canvas }, { jsPDF }] = await awaitCvPdf(Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]), signal);
  const printCss = collectPrintCss();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const renderScale = 3;

  pdf.setProperties({
    title,
    subject: "BlueDeck verified crew CV",
    author,
    creator: "BlueDeck Yacht Management Platform",
  });

  const restoreFontMetricStyles = installHtml2CanvasFontMetricStyles();
  try {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      assertCvPdfActive(signal);
      const page = pages[pageIndex];
      const exportRoot = page.closest(".bd-cv-print-root") || page;
      let portrait: CvPdfPortrait | null = null;
      onPage?.(pageIndex + 1, pages.length);
      // Cloning the whole profile also waits for hidden editor/preview photos.
      // Keep the CV and its page siblings so structural print selectors still match.
      const existingFrames = new Set(document.querySelectorAll("iframe.html2canvas-container"));
      const render = html2canvas(page, {
        scale: renderScale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 10000,
        windowWidth: 794,
        windowHeight: 1123,
        ignoreElements: (element) => !document.head.contains(element)
          && !element.contains(exportRoot) && !exportRoot.contains(element),
        onclone: async (clonedDocument, clonedPage) => {
          assertCvPdfActive(signal);
          const style = clonedDocument.createElement("style");
          style.dataset.cvPdfPrintStyles = "true";
          style.textContent = printCss;
          clonedDocument.head.appendChild(style);
          clonedDocument.body.classList.add("bd-pdf-exporting");

          const clonedRoot = clonedPage.closest<HTMLElement>(".bd-cv-print-root");
          if (clonedRoot) {
            clonedRoot.style.position = "static";
            clonedRoot.style.transform = "none";
            clonedRoot.style.opacity = "1";
            clonedRoot.style.pointerEvents = "auto";
          }

          clonedDocument.documentElement.style.width = "210mm";
          clonedDocument.documentElement.style.margin = "0";
          clonedDocument.documentElement.style.padding = "0";
          clonedDocument.documentElement.style.setProperty("background-color", "#ffffff", "important");
          clonedDocument.documentElement.style.setProperty("color", "#242a31", "important");
          clonedDocument.body.style.width = "210mm";
          clonedDocument.body.style.margin = "0";
          clonedDocument.body.style.padding = "0";
          clonedDocument.body.style.setProperty("background-color", "#ffffff", "important");
          clonedDocument.body.style.setProperty("color", "#242a31", "important");
          if (clonedDocument.fonts) await awaitCvPdf(clonedDocument.fonts.ready, signal);
          portrait = prepareCvPdfPortrait(clonedPage);
          await normalizeCvPhotoCrops(clonedPage, renderScale, signal);
          await rasterizeCvExportSvgs(clonedPage, signal);
          assertCvPdfActive(signal);
          normalizeCvExportColors(clonedPage);
        },
      });
      // html2canvas creates its iframe synchronously before its first await.
      // A timed-out render must not leave that hidden document behind.
      const renderFrames = Array.from(document.querySelectorAll("iframe.html2canvas-container"))
        .filter((frame) => !existingFrames.has(frame));
      render.then((canvas) => {
        if (signal.aborted) {
          canvas.width = 1;
          canvas.height = 1;
        }
      }, () => undefined);
      try {
        const canvas = await awaitCvPdf(render, signal);
        try {
          assertCvPdfActive(signal);
          if (pageIndex > 0) pdf.addPage("a4", "portrait");
          pdf.addImage(canvas, "PNG", 0, 0, 210, 297, undefined, "FAST");
          if (portrait) addCvPdfPortrait(pdf, portrait);
        } finally {
          canvas.width = 1;
          canvas.height = 1;
        }
      } finally {
        renderFrames.forEach((frame) => frame.remove());
      }
    }
  } finally {
    restoreFontMetricStyles();
  }

  assertCvPdfActive(signal);
  const pdfBlob = pdf.output("blob");
  assertCvPdfActive(signal);
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 45000);
}

type CvPdfPortrait = {
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  frame: { x: number; y: number; width: number; height: number };
};

function prepareCvPdfPortrait(page: HTMLElement): CvPdfPortrait | null {
  const image = page.querySelector<HTMLImageElement>(".bd-print-avatar img");
  if (!image) return null;
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("CV portrait is not ready for export.");
  }

  // Measure the actual inner photo box after print styles, excluding its white ring.
  // Embed the original pixels in the PDF instead of downsampling them into the page.
  const pageBounds = page.getBoundingClientRect();
  const bounds = image.getBoundingClientRect();
  const canvas = page.ownerDocument.createElement("canvas");
  try {
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CV portrait could not be prepared.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Browser-decoded PNG also covers AVIF/WebP sources and their orientation.
    // jsPDF cannot embed every format accepted by the image proxy directly.
    const portrait = {
      source: canvas.toDataURL("image/png"),
      sourceWidth: canvas.width,
      sourceHeight: canvas.height,
      frame: {
        x: (bounds.left - pageBounds.left) * 210 / pageBounds.width,
        y: (bounds.top - pageBounds.top) * 297 / pageBounds.height,
        width: bounds.width * 210 / pageBounds.width,
        height: bounds.height * 297 / pageBounds.height,
      },
    };
    image.style.setProperty("visibility", "hidden", "important");
    return portrait;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

function addCvPdfPortrait(pdf: jsPDF, portrait: CvPdfPortrait) {
  const { source, sourceWidth, sourceHeight, frame } = portrait;
  const placement = cvPdfCoverRect(sourceWidth, sourceHeight, frame);
  pdf.saveGraphicsState();
  try {
    pdf.ellipse(frame.x + frame.width / 2, frame.y + frame.height / 2,
      frame.width / 2, frame.height / 2, null);
    pdf.clip();
    pdf.discardPath();
    pdf.addImage(source, placement.x, placement.y, placement.width, placement.height, undefined, "FAST");
  } finally {
    pdf.restoreGraphicsState();
  }
}

async function normalizeCvPhotoCrops(page: HTMLElement, scale: number, signal: AbortSignal) {
  const document = page.ownerDocument;
  const view = document.defaultView;
  if (!view) return;

  const tasks = Array.from(page.querySelectorAll("img")).map(async (image) => {
    if (image.closest(".bd-print-avatar") || view.getComputedStyle(image).objectFit !== "cover") return;
    assertCvPdfActive(signal);
    const bounds = image.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !image.naturalWidth || !image.naturalHeight) return;

    // html2canvas stretches replaced images and ignores object-fit. Pre-crop only
    // the clone so the saved PDF uses the browser's centered cover proportions.
    const canvas = document.createElement("canvas");
    let source: string;
    try {
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CV photo crop could not be prepared.");
      const crop = cvPdfCoverRect(image.naturalWidth, image.naturalHeight,
        { x: 0, y: 0, width: canvas.width, height: canvas.height });
      context.imageSmoothingQuality = "high";
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height);
      source = canvas.toDataURL("image/png");
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
    assertCvPdfActive(signal);
    image.removeAttribute("srcset");
    image.src = source;
    await awaitCvPdf(image.decode(), signal);
  });
  const results = await awaitCvPdf(Promise.allSettled(tasks), signal);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}

function installHtml2CanvasFontMetricStyles() {
  // html2canvas measures text baselines with a hidden 1px GIF; Tailwind's block-image reset skews it.
  const style = document.createElement("style");
  style.dataset.cvPdfFontMetrics = "true";
  style.textContent = `
    body > div:last-child > img[src^="data:image/gif;base64,"],
    body > div[style*="visibility: hidden"] > img[src^="data:image/gif;base64,"] {
      display: inline-block !important;
      width: 1px !important;
      height: 1px !important;
      max-width: none !important;
    }
  `;
  document.head.appendChild(style);
  return () => style.remove();
}

async function rasterizeCvExportSvgs(root: HTMLElement, signal: AbortSignal) {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view) return;

  const svgs = Array.from(root.querySelectorAll<SVGSVGElement>("svg.lucide"));
  await awaitCvPdf(Promise.all(
    svgs.map(async (svg) => {
      assertCvPdfActive(signal);
      const bounds = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const computed = view.getComputedStyle(svg);
      const serializedSvg = svg.cloneNode(true) as SVGSVGElement;

      serializedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      serializedSvg.setAttribute("width", String(width));
      serializedSvg.setAttribute("height", String(height));
      serializedSvg.style.width = `${width}px`;
      serializedSvg.style.height = `${height}px`;
      serializedSvg.style.color = computed.color;

      const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        new XMLSerializer().serializeToString(serializedSvg),
      )}`;
      const sourceImage = document.createElement("img");
      let timeout: ReturnType<typeof setTimeout> | undefined;

      try {
        await awaitCvPdf(new Promise<void>((resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("CV icon loading timed out.")), 2000);
          sourceImage.onload = () => resolve();
          sourceImage.onerror = () => reject(new Error("CV icon could not be rasterized."));
          sourceImage.src = source;
        }), signal);
        assertCvPdfActive(signal);

        const iconScale = 4;
        const canvas = document.createElement("canvas");
        canvas.width = width * iconScale;
        canvas.height = height * iconScale;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.scale(iconScale, iconScale);
        context.drawImage(sourceImage, 0, 0, width, height);

        // Keep the populated canvas in the cloned DOM. Converting it to a new data-URL
        // image introduces an async decode race: html2canvas can snapshot naturalWidth=0
        // before that image has loaded and permanently skip the icon.
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.display = computed.display === "inline" ? "block" : computed.display;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.flexShrink = computed.flexShrink;
        canvas.style.opacity = computed.opacity;
        canvas.style.verticalAlign = computed.verticalAlign;
        canvas.style.marginTop = computed.marginTop;
        canvas.style.marginRight = computed.marginRight;
        canvas.style.marginBottom = computed.marginBottom;
        canvas.style.marginLeft = computed.marginLeft;
        svg.replaceWith(canvas);
      } catch {
        assertCvPdfActive(signal);
        // Keep the original SVG if the browser cannot rasterize a particular icon.
      } finally {
        clearTimeout(timeout);
        sourceImage.onload = null;
        sourceImage.onerror = null;
      }
    }),
  ), signal);
}

const unsupportedPdfColorPattern =
  /\b(?:oklab|oklch|lab|lch|color|color-mix|light-dark|device-cmyk)\(/i;

function elementClassName(element: Element) {
  return element.getAttribute("class") || "";
}

function cvPdfTextFallback(element: Element) {
  const classes = elementClassName(element);

  if (element.closest(".bd-print-hero-band, .bd-print-contact-line i")) return "#ffffff";
  if (classes.includes("text-white") || classes.includes("text-cyan-200")) return "#ffffff";
  if (
    element.matches(".bd-print-label, .bd-print-subsection-label") ||
    classes.includes("text-cyan") ||
    classes.includes("text-sky")
  ) {
    return "#2d7482";
  }
  if (classes.includes("text-slate-500") || classes.includes("text-slate-600")) return "#52616d";
  return "#25313a";
}

function cvPdfBackgroundFallback(element: Element) {
  const classes = elementClassName(element);

  if (element.classList.contains("bd-print-hero-band")) return "#071631";
  if (element.classList.contains("bd-print-sidebar")) return "#e7ecee";
  if (
    element.classList.contains("bd-print-page") ||
    element.classList.contains("bd-print-main") ||
    element.classList.contains("bd-print-experience-body") ||
    element.classList.contains("bd-print-reference-card")
  ) {
    return "#ffffff";
  }
  if (element.classList.contains("bd-print-experience-meta")) return "#ffffff";
  if (element.classList.contains("bd-print-experience-placeholder")) return "#edf3f5";
  if (element.classList.contains("bd-print-document-row")) return "#f6f8f8";
  if (element.matches(".bd-print-experience-top span, .bd-print-contact-line i")) return "#173f4a";
  if (classes.includes("bg-white")) return "#ffffff";
  if (classes.includes("bg-[#071631]")) return "#071631";
  if (classes.includes("bg-[#e7ecee]")) return "#e7ecee";
  if (classes.includes("bg-[#f6f8f8]")) return "#f6f8f8";
  if (classes.includes("bg-[#f3f7f8]")) return "#f3f7f8";
  if (classes.includes("bg-[#1d4852]")) return "#1d4852";
  return "rgba(0, 0, 0, 0)";
}

function setImportantColor(style: CSSStyleDeclaration, property: string, value: string) {
  style.setProperty(property, value, "important");
}

function replaceUnsupportedColor(
  style: CSSStyleDeclaration,
  property: string,
  value: string | null | undefined,
  fallback: string,
) {
  if (!unsupportedPdfColorPattern.test(value || "")) return;
  setImportantColor(style, property, fallback);
}

function normalizeCvExportColors(root: HTMLElement) {
  const view = root.ownerDocument.defaultView || window;
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>("*"))];

  elements.forEach((element) => {
    const computed = view.getComputedStyle(element);
    const style = element.style;
    const textFallback = cvPdfTextFallback(element);
    const backgroundFallback = cvPdfBackgroundFallback(element);
    const borderFallback = "#d8e2e6";
    const textColor = unsupportedPdfColorPattern.test(computed.color) ? textFallback : computed.color;

    replaceUnsupportedColor(style, "color", computed.color, textFallback);
    replaceUnsupportedColor(style, "background-color", computed.backgroundColor, backgroundFallback);
    replaceUnsupportedColor(style, "border-top-color", computed.borderTopColor, borderFallback);
    replaceUnsupportedColor(style, "border-right-color", computed.borderRightColor, borderFallback);
    replaceUnsupportedColor(style, "border-bottom-color", computed.borderBottomColor, borderFallback);
    replaceUnsupportedColor(style, "border-left-color", computed.borderLeftColor, borderFallback);
    replaceUnsupportedColor(style, "outline-color", computed.outlineColor, borderFallback);
    replaceUnsupportedColor(style, "text-decoration-color", computed.textDecorationColor, textColor);
    replaceUnsupportedColor(style, "-webkit-text-stroke-color", computed.webkitTextStrokeColor, textColor);

    if (unsupportedPdfColorPattern.test(computed.backgroundImage || "")) {
      style.setProperty("background-image", "none", "important");
    }

    if (unsupportedPdfColorPattern.test(computed.boxShadow || "")) {
      style.setProperty("box-shadow", "none", "important");
    }
    if (unsupportedPdfColorPattern.test(computed.textShadow || "")) {
      style.setProperty("text-shadow", "none", "important");
    }

    if (element.namespaceURI === "http://www.w3.org/2000/svg") {
      replaceUnsupportedColor(style, "fill", computed.getPropertyValue("fill"), textColor);
      replaceUnsupportedColor(style, "stroke", computed.getPropertyValue("stroke"), textColor);
    }
  });
}

function collectPrintCss() {
  const printRules: string[] = [];

  const collectRules = (rules: CSSRuleList) => {
    Array.from(rules).forEach((rule) => {
      if (rule.type === CSSRule.MEDIA_RULE) {
        const mediaRule = rule as CSSMediaRule;
        if (mediaRule.media.mediaText.toLowerCase().includes("print")) {
          printRules.push(...Array.from(mediaRule.cssRules, (nestedRule) => nestedRule.cssText));
          return;
        }
      }

      if ("cssRules" in rule) {
        const nestedRules = (rule as CSSGroupingRule).cssRules;
        if (nestedRules) collectRules(nestedRules);
      }
    });
  };

  Array.from(document.styleSheets).forEach((styleSheet) => {
    try {
      collectRules(styleSheet.cssRules);
    } catch {
      // Cross-origin stylesheets are not needed for the self-contained CV renderer.
    }
  });

  return printRules.join("\n");
}
