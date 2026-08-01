"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function AccessibleImageLightbox({
  source,
  imageAlt,
  dialogLabel,
  closeLabel,
  onClose,
}: {
  source: string;
  imageAlt: string;
  dialogLabel: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const returnFocusTarget =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06111f]/72 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl rounded-[24px] bg-white p-3 shadow-2xl shadow-slate-950/40 sm:rounded-[28px]">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="bd-focus absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#06111f] shadow-lg shadow-slate-950/25 transition hover:bg-cyan-50"
          aria-label={closeLabel}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <img
          src={source}
          alt={imageAlt}
          className="max-h-[82vh] w-full rounded-[18px] object-contain sm:rounded-[22px]"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
