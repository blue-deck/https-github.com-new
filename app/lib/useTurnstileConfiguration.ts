"use client";

import { useEffect, useState } from "react";
import { plausibleTurnstileSiteKey } from "./turnstileClient";

type PublicTurnstileConfiguration = {
  ready: boolean;
  enabled: boolean;
  siteKey: string;
  unavailable: boolean;
};

const compiledSiteKey = plausibleTurnstileSiteKey(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
);

export function useTurnstileConfiguration() {
  const [attempt, setAttempt] = useState(0);
  const [configuration, setConfiguration] = useState<PublicTurnstileConfiguration>({
    ready: false,
    enabled: true,
    siteKey: "",
    unavailable: false,
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    async function loadConfiguration() {
      try {
        const response = await fetch("/api/auth/security-config", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Configuration unavailable");
        const payload = (await response.json()) as Partial<PublicTurnstileConfiguration> | null;
        const siteKey = plausibleTurnstileSiteKey(payload?.siteKey);
        if (!payload || typeof payload.enabled !== "boolean" || (payload.enabled && !siteKey)) {
          throw new Error("Invalid security configuration");
        }
        if (active) setConfiguration({ ready: true, enabled: payload.enabled, siteKey, unavailable: false });
      } catch {
        if (!active) return;
        // A compiled public key can recover a failed probe. Without any key,
        // keep the form locked and offer a retry rather than treating it as off.
        setConfiguration({
          ready: Boolean(compiledSiteKey),
          enabled: true,
          siteKey: compiledSiteKey,
          unavailable: !compiledSiteKey,
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadConfiguration();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  return {
    ...configuration,
    retry: () => {
      setConfiguration({ ready: false, enabled: true, siteKey: "", unavailable: false });
      setAttempt((value) => value + 1);
    },
  };
}
