"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import styles from "./ContractPdfPreview.module.css";

const workerSource = "/pdfjs/6.3.289/pdf.worker.min.mjs";
const maximumCanvasPixels = 8_388_608;
const maximumCanvasSide = 4096;

type LoadedDocument = { pdf: PDFDocumentProxy; blob: Blob; attempt: number };

/** Read the same PDF bytes offered for download, in normal document flow. */
export default function ContractPdfPreview({ blob, language = "en", onDocumentReadyChange }: {
  blob: Blob; language?: string; onDocumentReadyChange?: (ready: boolean) => void;
}) {
  const tr = language === "tr";
  const stackRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 0, dpr: 1 });
  const pdf = loaded?.blob === blob && loaded.attempt === attempt ? loaded.pdf : null;

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    setLoaded(null);
    setFailed(false);
    onDocumentReadyChange?.(false);
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setFailed(true);
      onDocumentReadyChange?.(false);
      if (loadingTask) void loadingTask.destroy().catch(() => undefined);
    }, 30000);

    async function openDocument() {
      try {
        const [pdfjs, bytes] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          blob.arrayBuffer(),
        ]);
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSource;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
        const document = await loadingTask.promise;
        if (active) {
          setLoaded({ pdf: document, blob, attempt });
          // Parsing succeeded. A later canvas failure must still allow the
          // original, valid PDF to be downloaded through the parent toolbar.
          onDocumentReadyChange?.(true);
        }
      } catch {
        if (active) {
          setFailed(true);
          onDocumentReadyChange?.(false);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void openDocument();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      onDocumentReadyChange?.(false);
      if (loadingTask) void loadingTask.destroy().catch(() => undefined);
    };
  }, [blob, attempt, onDocumentReadyChange]);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    let frame = 0;
    const measure = () => {
      const width = Math.max(0, Math.floor(stack.clientWidth));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      setSize((current) => current.width === width && current.dpr === dpr ? current : { width, dpr });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stack);
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className={styles.preview} aria-label={tr ? "Kontrat PDF önizlemesi" : "Contract PDF preview"} data-i18n-ignore data-contract-pdf-preview data-page-count={pdf?.numPages ?? 0}>
      <div ref={stackRef} className={styles.stack}>
        {failed ? <div className={styles.documentStatus} role="alert">
          <p>{tr ? "PDF belgesi açılamadı. Lütfen yeniden deneyin." : "The PDF document could not be opened. Please try again."}</p>
          <button type="button" className={styles.retry} onClick={() => setAttempt((current) => current + 1)}><RefreshCw size={16} aria-hidden="true" />{tr ? "Yeniden dene" : "Try again"}</button>
        </div> : !pdf ? <div className={styles.documentStatus} role="status"><LoaderCircle size={22} className={styles.spinner} aria-hidden="true" /><p>{tr ? "PDF sayfaları hazırlanıyor…" : "Preparing PDF pages…"}</p></div> : Array.from({ length: pdf.numPages }, (_, index) => (
          <ContractPdfPage key={`${attempt}:${index}`} pdf={pdf} pageNumber={index + 1} width={size.width} dpr={size.dpr} tr={tr} />
        ))}
      </div>
    </section>
  );
}

function ContractPdfPage({ pdf, pageNumber, width, dpr, tr }: {
  pdf: PDFDocumentProxy; pageNumber: number; width: number; dpr: number; tr: boolean;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textId = useId();
  const [nearby, setNearby] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(210 / 297);
  const [text, setText] = useState("");
  const [rendered, setRendered] = useState("");
  const [failedKey, setFailedKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const renderKey = `${width}:${dpr}:${attempt}`;
  const ready = nearby && rendered === renderKey;
  const failed = failedKey === renderKey;
  const label = tr ? `Sayfa ${pageNumber} / ${pdf.numPages}` : `Page ${pageNumber} of ${pdf.numPages}`;

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setNearby(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { rootMargin: "800px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!nearby || width <= 0) {
      canvas.width = 0;
      canvas.height = 0;
      setRendered("");
      return;
    }
    let active = true;
    let page: PDFPageProxy | undefined;
    let task: RenderTask | undefined;
    let stagingCanvas: HTMLCanvasElement | undefined;
    setFailedKey("");
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      task?.cancel();
      setFailedKey(renderKey);
    }, 30000);

    async function renderPage() {
      try {
        page = await pdf.getPage(pageNumber);
        if (!active) return;
        const base = page.getViewport({ scale: 1 });
        setAspectRatio(base.width / base.height);
        const viewport = page.getViewport({ scale: width / base.width });
        const outputScale = Math.min(dpr,
          Math.sqrt(maximumCanvasPixels / (viewport.width * viewport.height)),
          maximumCanvasSide / Math.max(viewport.width, viewport.height));
        stagingCanvas = document.createElement("canvas");
        stagingCanvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        stagingCanvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        task = page.render({
          canvas: stagingCanvas,
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          background: "#ffffff",
        });
        const [, content] = await Promise.all([task.promise, page.getTextContent().catch(() => null)]);
        if (!active) return;
        const context = canvas!.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable.");
        canvas!.width = stagingCanvas.width;
        canvas!.height = stagingCanvas.height;
        context.drawImage(stagingCanvas, 0, 0);
        setText(content?.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ") ?? "");
        setRendered(renderKey);
      } catch {
        if (active) setFailedKey(renderKey);
      } finally {
        window.clearTimeout(timeout);
        if (stagingCanvas) {
          stagingCanvas.width = 0;
          stagingCanvas.height = 0;
        }
        page?.cleanup();
      }
    }
    void renderPage();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      task?.cancel();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [pdf, pageNumber, nearby, width, dpr, renderKey]);

  return (
    <figure ref={pageRef} className={styles.page} data-contract-pdf-page={pageNumber} data-ready={ready}>
      <figcaption className={styles.pageLabel}>{label}</figcaption>
      <div className={styles.sheet} style={{ aspectRatio }} aria-busy={nearby && !ready && !failed}>
        <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} aria-describedby={textId} aria-hidden={!ready} />
        <p id={textId} className={styles.srOnly}>{text || (tr ? "Sayfa metnine indirilen PDF üzerinden erişebilirsiniz." : "Page text is available in the downloaded PDF.")}</p>
        {!ready && <div className={styles.pageStatus}>
          {failed ? <div role="alert"><p>{tr ? "Bu sayfa yüklenemedi." : "This page could not be loaded."}</p><button type="button" className={styles.retry} onClick={() => setAttempt((current) => current + 1)}><RefreshCw size={16} aria-hidden="true" />{tr ? "Yeniden dene" : "Try again"}</button></div> : nearby ? <LoaderCircle size={22} className={styles.spinner} aria-label={tr ? "Sayfa yükleniyor" : "Loading page"} /> : null}
        </div>}
      </div>
    </figure>
  );
}
