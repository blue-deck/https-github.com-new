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
  const renderScale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));

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
        clonedDocument.body.style.width = "210mm";
        clonedDocument.body.style.margin = "0";
        clonedDocument.body.style.padding = "0";
        await clonedDocument.fonts?.ready;
      },
    });

    if (pageIndex > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(canvas, "JPEG", 0, 0, 210, 297, undefined, "FAST");
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
