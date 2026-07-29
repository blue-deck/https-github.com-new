"use client";

import { useEffect, useState } from "react";

type PublicTurnstileConfiguration = {
  enabled: boolean;
  siteKey: string;
};

const compiledSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export function useTurnstileConfiguration() {
  const [configuration, setConfiguration] =
    useState<PublicTurnstileConfiguration>({
      enabled: false,
      siteKey: "",
    });

  useEffect(() => {
    let active = true;

    async function loadConfiguration() {
      try {
        const response = await fetch("/api/auth/security-config", {
          cache: "no-store",
        });
        const payload = (await response.json()) as Partial<PublicTurnstileConfiguration>;

        if (!active || !response.ok) return;

        setConfiguration({
          enabled: payload.enabled === true && Boolean(payload.siteKey),
          siteKey: typeof payload.siteKey === "string" ? payload.siteKey : "",
        });
      } catch {
        if (!active || !compiledSiteKey) return;

        // If the configuration probe alone fails, showing the compiled widget
        // still lets a correctly configured server validate the request.
        setConfiguration({ enabled: true, siteKey: compiledSiteKey });
      }
    }

    void loadConfiguration();

    return () => {
      active = false;
    };
  }, []);

  return configuration;
}
