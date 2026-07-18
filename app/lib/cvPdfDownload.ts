type CvPdfDownloadInput = {
  pages: HTMLElement[];
  fileName: string;
  title: string;
  author: string;
};

export async function downloadCvPages({ pages, fileName, title, author }: CvPdfDownloadInput) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const printCss = collectPrintCss();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const renderScale = 3;

  pdf.setProperties({
    title,
    subject: "BlueDeck verified crew CV",
    author,
    creator: "BlueDeck Yacht Management Platform",
  });

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const canvas = await html2canvas(pages[pageIndex], {
      scale: renderScale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 30000,
      windowWidth: 794,
      windowHeight: 1123,
      onclone: async (clonedDocument, clonedPage) => {
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
        await clonedDocument.fonts?.ready;
        normalizeCvExportColors(clonedPage);
      },
    });

    if (pageIndex > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(canvas, "PNG", 0, 0, 210, 297, undefined, "FAST");
    canvas.width = 1;
    canvas.height = 1;
  }

  const pdfBlob = pdf.output("blob");
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

  if (element.classList.contains("bd-print-hero-band")) return "#20242a";
  if (element.classList.contains("bd-print-sidebar")) return "#e7ecee";
  if (
    element.classList.contains("bd-print-page") ||
    element.classList.contains("bd-print-main") ||
    element.classList.contains("bd-print-experience-body") ||
    element.classList.contains("bd-print-reference-card")
  ) {
    return "#ffffff";
  }
  if (element.classList.contains("bd-print-experience-meta")) return "#f3f7f8";
  if (element.classList.contains("bd-print-experience-placeholder")) return "#edf3f5";
  if (element.classList.contains("bd-print-document-row")) return "#f6f8f8";
  if (element.matches(".bd-print-experience-top span, .bd-print-contact-line i")) return "#173f4a";
  if (classes.includes("bg-white")) return "#ffffff";
  if (classes.includes("bg-[#20242a]")) return "#20242a";
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
