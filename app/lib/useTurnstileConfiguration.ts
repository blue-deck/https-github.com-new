"use client";

import { useEffect, useState } from "react";

type PublicTurnstileConfiguration = {
  ready: boolean;
  enabled: boolean;
  siteKey: string;
};

const compiledSiteKey = plausibleSiteKey(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
);

export function useTurnstileConfiguration() {
  const [configuration, setConfiguration] =
    useState<PublicTurnstileConfiguration>({
      ready: false,
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
        if (!response.ok) {
          if (!active) return;
          setConfiguration({
            ready: true,
            enabled: Boolean(compiledSiteKey),
            siteKey: compiledSiteKey,
          });
          return;
        }
        const payload =
          (await response.json()) as Partial<PublicTurnstileConfiguration>;

        if (!active) return;

        setConfiguration({
          ready: true,
          enabled: payload.enabled === true && Boolean(payload.siteKey),
          siteKey: typeof payload.siteKey === "string" ? payload.siteKey : "",
        });
      } catch {
        if (!active) return;

        // If the configuration probe alone fails, showing the compiled widget
        // still lets a correctly configured server validate the request.
        setConfiguration({
          ready: true,
          enabled: Boolean(compiledSiteKey),
          siteKey: compiledSiteKey,
        });
      }
    }

    void loadConfiguration();

    return () => {
      active = false;
    };
  }, []);

  return configuration;
}

function plausibleSiteKey(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 20 &&
    trimmed.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(trimmed) &&
    !/^(placeholder|changeme|turnstile|example)/i.test(trimmed)
    ? trimmed
    : "";
}
