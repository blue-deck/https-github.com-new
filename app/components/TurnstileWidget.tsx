"use client";

import { useEffect, useRef, useState } from "react";
import { loadTurnstile } from "../lib/turnstileClient";

type TurnstileWidgetProps = {
  siteKey: string;
  action?: string;
  className?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  retryLabel?: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
};

export function TurnstileWidget({
  siteKey,
  action = "forgot_password",
  className = "",
  theme = "light",
  size,
  retryLabel = "Retry security check",
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const widthRef = useRef<HTMLDivElement | null>(null);
  const [responsiveSize, setResponsiveSize] = useState<"compact" | "flexible" | null>(null);
  const resolvedSize = size ?? responsiveSize;
  const [attempt, setAttempt] = useState(0);
  const [needsRetry, setNeedsRetry] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (size || !widthRef.current) return;
    const container = widthRef.current;
    const measure = () => setResponsiveSize(
      container.getBoundingClientRect().width < 300 ? "compact" : "flexible",
    );
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [size]);

  useEffect(() => {
    if (!resolvedSize) return;
    const widgetSize = resolvedSize;
    let active = true;
    let widgetId: string | null = null;
    let verifiedAt = 0;
    let retryTimer: number | undefined;
    let scriptAttempts = 0;

    function failed() {
      if (!active) return;
      verifiedAt = 0;
      setNeedsRetry(true);
      callbacksRef.current.onError();
    }

    function expired() {
      if (!active) return;
      verifiedAt = 0;
      callbacksRef.current.onExpire();
    }

    async function initialize() {
      try {
        const api = await loadTurnstile();
        if (!active || !containerRef.current) return;
        widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          size: widgetSize,
          retry: "auto",
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          callback: (token) => {
            if (!active) return;
            if (!token) return expired();
            verifiedAt = Date.now();
            setNeedsRetry(false);
            callbacksRef.current.onVerify(token);
          },
          "expired-callback": expired,
          "timeout-callback": expired,
          "error-callback": () => {
            failed();
            return true;
          },
        });
      } catch {
        if (!active) return;
        failed();
        // Retry a transient script/render failure once; the visible retry action
        // remains available if a blocker or offline connection persists.
        if (scriptAttempts++ === 0) retryTimer = window.setTimeout(initialize, 1_500);
      }
    }

    function checkResumedToken() {
      if (document.visibilityState !== "visible" || !verifiedAt) return;
      if (Date.now() - verifiedAt < 300_000) return;
      expired();
      if (widgetId !== null) {
        try { window.turnstile?.reset(widgetId); } catch { failed(); }
      }
    }

    callbacksRef.current.onExpire();
    void initialize();
    document.addEventListener("visibilitychange", checkResumedToken);

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", checkResumedToken);
      if (widgetId !== null) {
        try { window.turnstile?.remove(widgetId); } catch { /* Already removed by the provider. */ }
      }
    };
  }, [action, siteKey, theme, resolvedSize, attempt]);

  return (
    <div ref={widthRef} className={className} style={{ contain: "inline-size" }}>
      <div ref={containerRef} style={resolvedSize === "compact" ? { width: 150, marginInline: "auto" } : undefined} />
      {needsRetry && (
        <button
          type="button"
          onClick={() => {
            callbacksRef.current.onExpire();
            setNeedsRetry(false);
            setAttempt((value) => value + 1);
          }}
          className="bd-focus mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-cyan-800 underline underline-offset-4"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
