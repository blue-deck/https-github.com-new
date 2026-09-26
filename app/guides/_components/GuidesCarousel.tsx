"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GuideCard } from "./GuideCard";
import { guideSummaries as guides } from "./guide-index";
import styles from "./GuidesCarousel.module.css";

const DWELL_MS = 4_000;
const TRANSITION_MS = 720;
const modulo = (value: number, length: number) => ((value % length) + length) % length;

export function GuidesCarousel() {
  const count = guides.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(count);
  const movingRef = useRef(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState(count);
  const [visibleCount, setVisibleCount] = useState(Math.min(3, count));
  const [animated, setAnimated] = useState(false);
  const [moving, setMoving] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const canScroll = count > visibleCount;
  const running = canScroll && !manuallyPaused && !reducedMotion && inView && pageVisible;
  const active = canScroll ? modulo(position, count) : 0;

  const finishMovement = useCallback(() => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    if (count) {
      // Reset onto identical cards in the middle batch, without a visible rewind.
      const normalized = count + modulo(positionRef.current, count);
      if (normalized !== positionRef.current) {
        setAnimated(false);
        positionRef.current = normalized;
        setPosition(normalized);
      }
    }
    movingRef.current = false;
    setMoving(false);
  }, [count]);

  const move = useCallback((direction: number, manual = false) => {
    if (manual) setManuallyPaused(true);
    if (!canScroll || movingRef.current) return;
    const next = positionRef.current + direction;
    movingRef.current = true;
    positionRef.current = next;
    setAnimated(true);
    setMoving(true);
    setPosition(next);
    if (manual) setAnnouncement(`${modulo(next, count) + 1} / ${count}: ${guides[modulo(next, count)].title}`);
    // A fallback also settles the track if a resize or background tab cancels transitionend.
    transitionTimer.current = setTimeout(finishMovement, (reducedMotion ? 120 : TRANSITION_MS) + 100);
  }, [count, canScroll, finishMovement, reducedMotion]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(motion.matches);
    const syncVisibility = () => setPageVisible(document.visibilityState === "visible");
    syncMotion();
    syncVisibility();
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      motion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.15), { threshold: 0.15 });
    const resize = new ResizeObserver(() => {
      const slide = viewport.querySelector<HTMLElement>("[data-guide-slide]");
      if (!slide) return;
      const gap = parseFloat(getComputedStyle(slide.parentElement!).columnGap) || 0;
      const viewportStyle = getComputedStyle(viewport);
      const available = viewport.clientWidth - parseFloat(viewportStyle.paddingLeft) - parseFloat(viewportStyle.paddingRight) + gap;
      const step = slide.getBoundingClientRect().width + gap;
      setVisibleCount(Math.min(count, Math.max(1, Math.floor(available / step + 0.01))));
    });
    observer.observe(viewport);
    resize.observe(viewport);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, [count]);

  useEffect(() => {
    if (!running || moving) return;
    const timer = setTimeout(() => move(1), DWELL_MS);
    return () => clearTimeout(timer);
  }, [running, moving, position, move]);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClickRef.current = false;
    if (movingRef.current || !canScroll) return;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 9) {
      pointerRef.current = null;
      return;
    }
    if (!pointer.dragging && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      pointer.dragging = true;
      // A deliberate horizontal swipe gives control to the reader. A normal
      // vertical page scroll does not stop automatic rotation on mobile.
      setManuallyPaused(true);
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (pointer.dragging) {
      const cardWidth = event.currentTarget.querySelector<HTMLElement>("[data-guide-slide]")?.offsetWidth ?? 300;
      setAnimated(false);
      setDragOffset(Math.max(-cardWidth, Math.min(cardWidth, dx)));
    }
  }

  function releasePointer(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setAnimated(true);
    setDragOffset(0);
    if (!cancelled && pointer.dragging && Math.abs(event.clientX - pointer.x) > 45) {
      move(event.clientX < pointer.x ? 1 : -1, true);
    }
  }

  if (!count) return null;

  // Only one visible copy of each guide is exposed to assistive technology.
  // Offscreen batches remain inert; each visible card is a genuine guide link.
  const trackGuides = canScroll ? [...guides, ...guides, ...guides] : guides;
  const effectivePosition = canScroll ? position : 0;
  const carouselStyle = {
    "--guide-count": count,
    "--carousel-position": effectivePosition,
    "--drag-offset": `${dragOffset}px`,
    "--transition-ms": `${reducedMotion ? 120 : TRANSITION_MS}ms`,
  } as CSSProperties;

  return (
    <div
      className={styles.carousel}
      style={carouselStyle}
      role="region"
      aria-roledescription="karusel"
      aria-label="Rehberler"
      data-autoplay={running ? "playing" : "paused"}
      data-position={active + 1}
      data-visible-count={visibleCount}
      onFocusCapture={() => setManuallyPaused(true)}
    >
      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerLeave={() => {
          if (!pointerRef.current?.dragging) pointerRef.current = null;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => releasePointer(event)}
        onPointerCancel={(event) => releasePointer(event, true)}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }}
      >
        <div
          className={`${styles.track} ${animated ? styles.animated : ""}`}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "transform") finishMovement();
          }}
        >
          {trackGuides.map((guide, index) => {
            const visible = index >= effectivePosition && index < effectivePosition + visibleCount;
            return (
              <div
                className={styles.slide}
                key={`${guide.slug}-${index}`}
                data-guide-slide={index}
                role="group"
                aria-roledescription="slayt"
                aria-label={`${modulo(index, count) + 1} / ${count}`}
                aria-hidden={visible ? undefined : true}
                inert={!visible}
              >
                <GuideCard guide={guide} tabIndex={visible ? 0 : -1} />
              </div>
            );
          })}
        </div>
      </div>
      {canScroll && (
        <div className={styles.controls}>
          <div className={styles.position} aria-hidden="true">
            <span>{String(active + 1).padStart(2, "0")}</span>
            <div className={styles.progress}><span style={{ width: `${100 / count}%`, transform: `translateX(${active * 100}%)` }} /></div>
            <span>{String(count).padStart(2, "0")}</span>
          </div>
          <div className={styles.buttons}>
            <button type="button" className={styles.arrowButton} aria-label="Önceki rehber" aria-disabled={moving} onClick={() => move(-1, true)}><ArrowLeft aria-hidden /></button>
            <button type="button" className={styles.arrowButton} aria-label="Sonraki rehber" aria-disabled={moving} onClick={() => move(1, true)}><ArrowRight aria-hidden /></button>
          </div>
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  );
}
