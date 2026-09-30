export type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  retry?: "auto" | "never";
  "refresh-expired"?: "auto" | "manual" | "never";
  "refresh-timeout"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "error-callback"?: (code?: string) => boolean | void;
};

export type TurnstileApi = {
  ready?: (callback: () => void) => void;
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptId = "bluedeck-turnstile-script";
let scriptLoad: Promise<TurnstileApi> | null = null;

// One in-flight script for all mounted forms. A failed/blocked load is removed
// so a subsequent attempt can actually load it again, including after navigation.
export function loadTurnstile(): Promise<TurnstileApi> {
  if (scriptLoad) return scriptLoad;
  if (window.turnstile) return Promise.resolve(window.turnstile);

  scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const script = existing || document.createElement("script");
    let settled = false;
    const timeout = window.setTimeout(fail, 15_000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", fail);
    }

    function fail() {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(new Error("Security verification could not load."));
    }

    function loaded() {
      if (settled) return;
      const api = window.turnstile;
      if (!api) return fail();
      const ready = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(api);
      };
      if (api.ready) api.ready(ready);
      else ready();
    }

    script.addEventListener("load", loaded);
    script.addEventListener("error", fail);
    if (!existing) {
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    scriptLoad = null;
    throw error;
  });

  return scriptLoad;
}

export function plausibleTurnstileSiteKey(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length >= 20 &&
    trimmed.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(trimmed) &&
    !/^(placeholder|changeme|turnstile|example)/i.test(trimmed)
    ? trimmed
    : "";
}
