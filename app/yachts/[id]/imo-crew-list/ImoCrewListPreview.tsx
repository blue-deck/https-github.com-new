"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import styles from "./ImoCrewListPreview.module.css";

type Zoom = "fit" | "100" | "150";
type LoadedDocument = { pdf: PDFDocumentProxy; blob: Blob; attempt: number; id: number };
type RenderedPage = { key: string; text: string; blob: Blob };

const workerSource = "/pdfjs/6.3.289/pdf.worker.min.mjs";
const maximumCanvasPixels = 16_777_216;
const maximumCanvasSide = 8192;

/** Display the exact generated PDF bytes, rendering only the selected page. */
export default function ImoCrewListPreview({ blob, language }: { blob: Blob; language: string }) {
  const tr = language === "tr";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageAreaRef = useRef<HTMLDivElement>(null);
  const documentId = useRef(0);
  const textId = useId();
  const zoomId = useId();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [size, setSize] = useState({ width: 0, dpr: 1 });
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const [renderErrorKey, setRenderErrorKey] = useState("");
  const pdf = loaded?.blob === blob && loaded.attempt === attempt ? loaded.pdf : null;
  const renderWidth = zoom === "fit" ? size.width : 0;
  const renderKey = `${loaded?.id ?? 0}:${pageNumber}:${zoom}:${renderWidth}:${size.dpr}`;
  const pageReady = Boolean(pdf && rendered?.key === renderKey);
  const hasRenderedPage = rendered?.blob === blob;
  const hasError = loadError || renderErrorKey === renderKey;
  const pageLabel = pdf
    ? (tr ? `Sayfa ${pageNumber} / ${pdf.numPages}` : `Page ${pageNumber} of ${pdf.numPages}`)
    : (tr ? "PDF yükleniyor" : "Loading PDF");

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    setLoaded(null);
    setLoadError(false);
    setRenderErrorKey("");
    setPageNumber(1);

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
        if (!active) return;
        documentId.current += 1;
        setLoaded({ pdf: document, blob, attempt, id: documentId.current });
      } catch {
        if (active) setLoadError(true);
      }
    }

    void openDocument();
    return () => {
      active = false;
      // This releases document data, cached pages, fonts and the local worker.
      if (loadingTask) void loadingTask.destroy().catch(() => undefined);
    };
  }, [blob, attempt]);

  useEffect(() => {
    const element = viewportRef.current;
    const area = pageAreaRef.current;
    if (!element || !area) return;
    let frame = 0;
    const measure = () => {
      const style = window.getComputedStyle(element);
      const width = Math.max(0, Math.floor(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
      const dpr = window.devicePixelRatio || 1;
      setSize((current) => current.width === width && current.dpr === dpr ? current : { width, dpr });
    };
    const scheduleMeasure = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    // Measure a box whose dimensions are independent of the rendered page.
    // Canvas changes and scrollbars must not feed back into the fit-width scale.
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(area);
    window.addEventListener("resize", scheduleMeasure);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
      viewportRef.current.scrollLeft = 0;
    }
  }, [pdf, pageNumber]);

  useEffect(() => {
    if (!pdf || (zoom === "fit" && renderWidth <= 0)) return;
    let active = true;
    let page: PDFPageProxy | undefined;
    let task: RenderTask | undefined;
    let stagingCanvas: HTMLCanvasElement | undefined;
    setRenderErrorKey("");

    async function renderPage() {
      try {
        page = await pdf!.getPage(pageNumber);
        if (!active) return;
        const baseViewport = page.getViewport({ scale: 1 });
        // PDF points are 1/72 inch; CSS pixels are 1/96 inch at 100% zoom.
        const scale = zoom === "fit" ? renderWidth / baseViewport.width : Number(zoom) / 100 * 96 / 72;
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(
          size.dpr,
          Math.sqrt(maximumCanvasPixels / (viewport.width * viewport.height)),
          maximumCanvasSide / Math.max(viewport.width, viewport.height),
        );
        stagingCanvas = document.createElement("canvas");
        stagingCanvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        stagingCanvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        task = page.render({
          canvas: stagingCanvas,
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          background: "#ffffff",
        });
        const [, content] = await Promise.all([
          task.promise,
          page.getTextContent().catch(() => null),
        ]);
        if (!active || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable.");
        canvas.width = stagingCanvas.width;
        canvas.height = stagingCanvas.height;
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.drawImage(stagingCanvas, 0, 0);
        setRendered({
          key: renderKey,
          blob,
          text: content?.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ") ?? "",
        });
      } catch {
        if (active) setRenderErrorKey(renderKey);
      } finally {
        if (stagingCanvas) {
          stagingCanvas.width = 0;
          stagingCanvas.height = 0;
        }
        // cleanup returns false if another render of this page is still active.
        page?.cleanup();
      }
    }

    void renderPage();
    return () => {
      active = false;
      task?.cancel();
    };
  }, [pdf, pageNumber, zoom, renderWidth, size.dpr, renderKey, blob]);

  return (
    <section className={styles.preview} aria-label={tr ? "PDF önizlemesi" : "PDF preview"}>
      <div className={styles.toolbar}>
        <div className={styles.navigation}>
          <button type="button" disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} aria-label={tr ? "Önceki sayfa" : "Previous page"}><ChevronLeft size={18} /></button>
          <span className={styles.pageCount} role="status" aria-live="polite">{pageLabel}</span>
          <button type="button" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((current) => Math.min(pdf?.numPages ?? 1, current + 1))} aria-label={tr ? "Sonraki sayfa" : "Next page"}><ChevronRight size={18} /></button>
        </div>
        <div className={styles.zoom}>
          <label htmlFor={zoomId}>{tr ? "Görünüm" : "View"}</label>
          <select id={zoomId} value={zoom} onChange={(event) => setZoom(event.target.value as Zoom)}>
            <option value="fit">{tr ? "Genişliğe sığdır" : "Fit width"}</option>
            <option value="100">100%</option>
            <option value="150">150%</option>
          </select>
        </div>
      </div>
      <div ref={pageAreaRef} className={styles.pageArea}>
        <div ref={viewportRef} className={styles.viewport} tabIndex={0} aria-label={tr ? "PDF sayfası" : "PDF page"} aria-busy={!pageReady && !hasError}>
          <div className={styles.canvasFrame} data-has-page={hasRenderedPage} data-pending={!pageReady || hasError} aria-hidden={!pageReady || hasError}>
            <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={pageLabel} aria-describedby={textId} />
          </div>
          <p id={textId} className={styles.srOnly}>{pageReady && !hasError ? rendered?.text || (tr ? "Sayfa metnine indirilen PDF üzerinden erişebilirsiniz." : "Page text is available in the downloaded PDF.") : ""}</p>
        </div>
        {(hasError || !pageReady) && <div className={styles.statusOverlay}>
          {hasError ? <div className={styles.status} role="alert">
            <p>{tr ? "PDF önizlemesi açılamadı. Yeniden deneyin veya PDF’yi indirin." : "The PDF preview could not be opened. Try again or download the PDF."}</p>
            <button type="button" onClick={() => setAttempt((current) => current + 1)}><RefreshCw size={16} />{tr ? "Yeniden dene" : "Try again"}</button>
          </div> : <div className={styles.status} role="status"><LoaderCircle className={styles.spinner} size={23} /><p>{tr ? "PDF sayfası hazırlanıyor…" : "Rendering PDF page…"}</p></div>}
        </div>}
      </div>
    </section>
  );
}
