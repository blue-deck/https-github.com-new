"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { clearLegacySensitiveClientStorage } from "../lib/clientStorageSecurity";
import { useLanguage } from "./LanguageProvider";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

function getDisplayMode() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as IOSNavigator).standalone);

  return standalone ? "standalone" : "browser";
}

export function PlatformBridge() {
  const { language } = useLanguage();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    clearLegacySensitiveClientStorage();
  }, []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    function syncPlatformState() {
      const networkStatus = window.navigator.onLine ? "online" : "offline";
      document.documentElement.dataset.networkStatus = networkStatus;
      document.documentElement.dataset.displayMode = getDisplayMode();
      setOnline(networkStatus === "online");
    }

    syncPlatformState();
    window.addEventListener("online", syncPlatformState);
    window.addEventListener("offline", syncPlatformState);
    standaloneQuery.addEventListener?.("change", syncPlatformState);

    return () => {
      window.removeEventListener("online", syncPlatformState);
      window.removeEventListener("offline", syncPlatformState);
      standaloneQuery.removeEventListener?.("change", syncPlatformState);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      async function clearDevelopmentServiceWorkers() {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames
                .filter((cacheName) => cacheName.startsWith("bluedeck-yachtos"))
                .map((cacheName) => caches.delete(cacheName)),
            );
          }
        } catch (error) {
          console.warn("BlueDeck development cache could not be cleared.", error);
        }
      }

      void clearDevelopmentServiceWorkers();
      return;
    }

    let active = true;

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (active) await registration.update();
      } catch (error) {
        console.warn("BlueDeck offline support could not be registered.", error);
      }
    }

    void registerServiceWorker();

    return () => {
      active = false;
    };
  }, []);

  if (online) return null;

  return (
    <div className="bd-network-banner" role="status" aria-live="polite">
      <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>
        {language === "tr"
          ? "Çevrimdışısınız. Canlı veriler bağlantı geri gelene kadar kullanılamayabilir."
          : "You are offline. Live data may be unavailable until the connection returns."}
      </span>
    </div>
  );
}
