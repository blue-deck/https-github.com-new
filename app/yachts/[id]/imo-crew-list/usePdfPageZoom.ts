"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

type Point = { x: number; y: number };
type Anchor = { pageX: number; pageY: number; target: Point };
const minimumZoom = 1;
const maximumZoom = 6;

/** Keep gestures inside the PDF viewport; the surrounding app never scales. */
export function usePdfPageZoom(viewportRef: RefObject<HTMLDivElement | null>, frameRef: RefObject<HTMLDivElement | null>) {
  const [zoom, setZoom] = useState(1);
  const [renderZoom, setRenderZoom] = useState(1);
  const [anchorRevision, setAnchorRevision] = useState(0);
  const zoomRef = useRef(1);
  const anchorRef = useRef<Anchor | null>(null);

  const zoomAt = useCallback((requested: number, from: Point, target = from) => {
    const viewport = viewportRef.current;
    const frame = frameRef.current;
    if (!viewport || !frame) return;
    const bounds = frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const next = Math.min(maximumZoom, Math.max(minimumZoom, requested));
    if (next === zoomRef.current) {
      if (anchorRef.current) {
        anchorRef.current = { ...anchorRef.current, target };
        setAnchorRevision((current) => current + 1);
      }
      else {
        viewport.scrollLeft += from.x - target.x;
        viewport.scrollTop += from.y - target.y;
      }
      return;
    }
    // Two fingers can dispatch separate moves before React commits a frame.
    // Keep that frame's original page anchor instead of measuring stale geometry.
    const pending = anchorRef.current;
    anchorRef.current = pending
      ? { ...pending, target }
      : { pageX: (from.x - bounds.left) / bounds.width, pageY: (from.y - bounds.top) / bounds.height, target };
    zoomRef.current = next;
    setZoom(next);
    setAnchorRevision((current) => current + 1);
  }, [viewportRef, frameRef]);

  const resetZoom = useCallback(() => {
    anchorRef.current = null;
    zoomRef.current = 1;
    setZoom(1);
    setRenderZoom(1);
  }, []);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    // Wait for the resized canvas frame to participate in browser layout before
    // measuring its scroll extent. A synchronous read can still see the old size.
    const scheduled = requestAnimationFrame(() => {
      // A newer pointer event may be queued before its React commit. Let that
      // commit position the anchor instead of consuming it against an old width.
      if (zoom !== zoomRef.current) return;
      const anchor = anchorRef.current;
      const viewport = viewportRef.current;
      const frame = frameRef.current;
      if (!anchor || !viewport || !frame) return;
      const bounds = frame.getBoundingClientRect();
      viewport.scrollLeft += bounds.left + anchor.pageX * bounds.width - anchor.target.x;
      viewport.scrollTop += bounds.top + anchor.pageY * bounds.height - anchor.target.y;
      anchorRef.current = null;
    });
    return () => cancelAnimationFrame(scheduled);
  }, [zoom, anchorRevision, viewportRef, frameRef]);

  useEffect(() => {
    // Resize the existing canvas immediately; refresh sharp PDF pixels once the
    // gesture settles instead of cancelling PDF.js renders on every finger move.
    const timer = window.setTimeout(() => setRenderZoom(zoom), 160);
    return () => window.clearTimeout(timer);
  }, [zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const pointers = new Map<number, Point>();
    let previous: { distance: number; center: Point } | null = null;
    let safariStartZoom = 1;
    const centerOfViewport = () => {
      const bounds = viewport.getBoundingClientRect();
      return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    };
    const pinch = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? { distance: Math.hypot(a.x - b.x, a.y - b.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } : null;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      viewport.focus({ preventScroll: true });
      previous = pinch();
    };
    const move = (event: PointerEvent) => {
      const before = pointers.get(event.pointerId);
      if (!before) return;
      event.preventDefault();
      const current = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, current);
      const nextPinch = pinch();
      if (previous && nextPinch && previous.distance > 0) {
        zoomAt(zoomRef.current * nextPinch.distance / previous.distance, previous.center, nextPinch.center);
      } else if (pointers.size === 1) {
        viewport.scrollLeft += before.x - current.x;
        viewport.scrollTop += before.y - current.y;
      }
      previous = nextPinch;
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      previous = pinch();
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      zoomAt(zoomRef.current * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.005), { x: event.clientX, y: event.clientY });
    };
    const doubleClick = (event: MouseEvent) => {
      event.preventDefault();
      zoomAt(zoomRef.current > 1.05 ? 1 : 2, { x: event.clientX, y: event.clientY });
    };
    const key = (event: KeyboardEvent) => {
      if (!["+", "=", "-", "0"].includes(event.key)) return;
      event.preventDefault();
      zoomAt(event.key === "0" ? 1 : zoomRef.current * (event.key === "-" ? 0.8 : 1.25), centerOfViewport());
    };
    const gestureStart = (event: Event) => { event.preventDefault(); safariStartZoom = zoomRef.current; };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale;
      if (pointers.size < 2 && scale && Number.isFinite(scale)) zoomAt(safariStartZoom * scale, centerOfViewport());
    };
    viewport.addEventListener("pointerdown", down);
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerup", up);
    viewport.addEventListener("pointercancel", up);
    viewport.addEventListener("lostpointercapture", up);
    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("dblclick", doubleClick);
    viewport.addEventListener("keydown", key);
    viewport.addEventListener("gesturestart", gestureStart, { passive: false });
    viewport.addEventListener("gesturechange", gestureChange, { passive: false });
    return () => {
      viewport.removeEventListener("pointerdown", down);
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerup", up);
      viewport.removeEventListener("pointercancel", up);
      viewport.removeEventListener("lostpointercapture", up);
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("dblclick", doubleClick);
      viewport.removeEventListener("keydown", key);
      viewport.removeEventListener("gesturestart", gestureStart);
      viewport.removeEventListener("gesturechange", gestureChange);
    };
  }, [viewportRef, zoomAt]);

  return { zoom, renderZoom, resetZoom };
}
