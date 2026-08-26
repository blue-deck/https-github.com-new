"use client";

import type { Session } from "@supabase/supabase-js";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { clearLegacySensitiveClientStorage } from "../lib/clientStorageSecurity";
import {
  buildIdleLoginHref,
  createWebSessionActivityRecord,
  createWebSessionIdleLock,
  hasWebSessionIdleTimeoutElapsed,
  parseWebSessionActivity,
  parseWebSessionIdleLock,
  parseWebSessionLogoutMarker,
  remainingWebSessionIdleTime,
  resolveWebSessionId,
  resolveWebSessionLogoutTarget,
  selectReplacementWebSessionLogoutMarker,
  webSessionIdleLockApplies,
  WEB_SESSION_ACTIVITY_STORAGE_KEY,
  WEB_SESSION_ACTIVITY_WRITE_THROTTLE_MS,
  WEB_SESSION_IDLE_LOCK_STORAGE_KEY,
  WEB_SESSION_LOGOUT_EVENT,
  WEB_SESSION_LOGOUT_STORAGE_KEY,
  type WebSessionActivityRecord,
  type WebSessionLogoutMarker,
} from "../lib/webSessionInactivity";
import {
  readPersistedSupabaseBrowserSession,
  requestSupabaseBrowserSessionRevocation,
  supabase,
  supabaseAuthStorageKey,
  terminatePersistedSupabaseBrowserSession,
} from "../lib/supabase";
import { endWebBrowserSession } from "../lib/webBrowserSession";
import { useLanguage } from "./LanguageProvider";

const activityEvents = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
  "input",
] as const;
const idleLockConfirmationDelayMs = 100;
const crossTabLogoutSettlementDelayMs = 150;

export function WebSessionInactivityGuard() {
  const { language } = useLanguage();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let disposed = false;
    let authenticated = false;
    let logoutInFlight = false;
    let currentSessionId = "";
    let currentAccessToken = "";
    let currentRefreshToken = "";
    let activity: WebSessionActivityRecord | null = null;
    let activeLogoutMarker: WebSessionLogoutMarker | null = null;
    let lastPersistedAt = 0;
    let timeoutId: number | undefined;
    let activityFlushTimeoutId: number | undefined;
    const pendingLogoutMarkers = new Map<string, WebSessionLogoutMarker>();

    function readStorage(key: string) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    function writeStorage(key: string, value: unknown) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Keep the in-memory timer active when storage is unavailable.
      }
    }

    function removeStorage(key: string) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage may be unavailable in privacy modes.
      }
    }

    function rememberLogoutMarker(marker: WebSessionLogoutMarker) {
      const existing = pendingLogoutMarkers.get(marker.sessionId);
      if (!existing || marker.loggedOutAt >= existing.loggedOutAt) {
        pendingLogoutMarkers.set(marker.sessionId, marker);
      }

      if (pendingLogoutMarkers.size <= 8) return;
      const oldest = [...pendingLogoutMarkers.values()].sort(
        (left, right) => left.loggedOutAt - right.loggedOutAt,
      )[0];
      if (oldest) pendingLogoutMarkers.delete(oldest.sessionId);
    }

    function clearTimer() {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    function clearActivityFlushTimer() {
      if (activityFlushTimeoutId !== undefined) {
        window.clearTimeout(activityFlushTimeoutId);
      }
      activityFlushTimeoutId = undefined;
    }

    function storedActivity(now: number) {
      return parseWebSessionActivity(
        readStorage(WEB_SESSION_ACTIVITY_STORAGE_KEY),
        now,
      );
    }

    function adoptNewerStoredActivity(now: number) {
      const stored = storedActivity(now);
      if (
        stored?.sessionId === currentSessionId &&
        (!activity || stored.lastActivityAt > activity.lastActivityAt)
      ) {
        activity = stored;
        lastPersistedAt = stored.lastActivityAt;
      }
    }

    function scheduleExpiryCheck(now = Date.now()) {
      clearTimer();
      if (!authenticated || logoutInFlight || !activity) return;

      const remaining = remainingWebSessionIdleTime(
        activity,
        currentSessionId,
        now,
      );
      if (remaining === null) return;
      if (remaining === 0) {
        beginIdleLogout();
        return;
      }

      timeoutId = window.setTimeout(() => {
        checkExpiry();
      }, remaining);
    }

    function checkExpiry(now = Date.now()) {
      if (!authenticated || logoutInFlight || !activity) return false;

      adoptNewerStoredActivity(now);
      const idleLock = parseWebSessionIdleLock(
        readStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY),
        now,
      );
      if (
        idleLock &&
        webSessionIdleLockApplies(idleLock, activity, currentSessionId)
      ) {
        beginIdleLogout();
        return true;
      }
      if (idleLock?.sessionId === currentSessionId) {
        removeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY);
      }

      if (
        activity &&
        hasWebSessionIdleTimeoutElapsed(activity, currentSessionId, now)
      ) {
        beginIdleLogout();
        return true;
      }

      scheduleExpiryCheck(now);
      return false;
    }

    function persistActivity(now: number) {
      if (!currentSessionId) return;
      clearActivityFlushTimer();
      activity = createWebSessionActivityRecord(currentSessionId, now);
      lastPersistedAt = now;
      writeStorage(WEB_SESSION_ACTIVITY_STORAGE_KEY, activity);
    }

    function flushActivity() {
      clearActivityFlushTimer();
      if (
        !authenticated ||
        logoutInFlight ||
        !activity ||
        activity.lastActivityAt <= lastPersistedAt
      ) {
        return;
      }

      lastPersistedAt = activity.lastActivityAt;
      writeStorage(WEB_SESSION_ACTIVITY_STORAGE_KEY, activity);
    }

    function scheduleActivityFlush(now: number) {
      clearActivityFlushTimer();
      const delay = Math.max(
        0,
        WEB_SESSION_ACTIVITY_WRITE_THROTTLE_MS - (now - lastPersistedAt),
      );
      activityFlushTimeoutId = window.setTimeout(flushActivity, delay);
    }

    function recordActivity(event: Event) {
      if (
        !event.isTrusted ||
        !authenticated ||
        logoutInFlight ||
        !currentSessionId
      ) {
        return;
      }

      const now = Date.now();
      // An interaction at or after the deadline cannot revive an idle session.
      if (checkExpiry(now)) return;

      activity = createWebSessionActivityRecord(currentSessionId, now);
      if (now - lastPersistedAt >= WEB_SESSION_ACTIVITY_WRITE_THROTTLE_MS) {
        clearActivityFlushTimer();
        lastPersistedAt = now;
        writeStorage(WEB_SESSION_ACTIVITY_STORAGE_KEY, activity);
      } else {
        scheduleActivityFlush(now);
      }
      scheduleExpiryCheck(now);
    }

    function beginIdleLogout() {
      if (logoutInFlight || !currentSessionId) return;

      logoutInFlight = true;
      clearTimer();
      clearActivityFlushTimer();
      setLocked(true);
      const now = Date.now();
      adoptNewerStoredActivity(now);
      const existingIdleLock = parseWebSessionIdleLock(
        readStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY),
        now,
      );
      const idleLock =
        existingIdleLock &&
        webSessionIdleLockApplies(
          existingIdleLock,
          activity,
          currentSessionId,
        )
          ? existingIdleLock
          : createWebSessionIdleLock(
              currentSessionId,
              now,
              activity?.lastActivityAt || now,
            );
      writeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY, idleLock);

      const sessionIdAtExpiry = currentSessionId;
      const redirectHref = buildIdleLoginHref(
        window.location.pathname,
        window.location.search,
      );

      // A short confirmation window lets a concurrent, pre-deadline activity
      // write invalidate a stale tab's lock before credentials are removed.
      window.setTimeout(() => {
        confirmIdleLogout(sessionIdAtExpiry, redirectHref);
      }, idleLockConfirmationDelayMs);
    }

    function confirmIdleLogout(
      sessionIdAtExpiry: string,
      redirectHref: string,
    ) {
      const now = Date.now();
      adoptNewerStoredActivity(now);
      const idleLock = parseWebSessionIdleLock(
        readStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY),
        now,
      );

      if (!currentSessionId && idleLock?.sessionId === sessionIdAtExpiry) {
        void finishIdleLogout(redirectHref, sessionIdAtExpiry);
        return;
      }

      if (
        currentSessionId !== sessionIdAtExpiry ||
        !idleLock ||
        !webSessionIdleLockApplies(
          idleLock,
          activity,
          sessionIdAtExpiry,
        )
      ) {
        if (idleLock?.sessionId === sessionIdAtExpiry) {
          removeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY);
        }
        logoutInFlight = false;
        setLocked(false);
        scheduleExpiryCheck(now);
        return;
      }

      authenticated = false;
      void finishIdleLogout(redirectHref, sessionIdAtExpiry);
    }

    async function finishIdleLogout(
      redirectHref: string,
      sessionIdAtExpiry: string,
    ) {
      const ended = await endWebBrowserSession("idle", {
        accessToken: currentAccessToken,
        refreshToken: currentRefreshToken,
        expectedSessionId: sessionIdAtExpiry,
      });
      if (!ended) {
        removeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY);
        logoutInFlight = false;
        activeLogoutMarker = null;
        setLocked(false);
        void supabase.auth.getSession().then(({ data }) => {
          if (disposed) return;
          if (data.session) establishSession(data.session);
          else clearEndedSession();
        });
        return;
      }

      window.location.replace(redirectHref);
    }

    function establishSession(session: Session) {
      const nextSessionId = resolveWebSessionId(
        session.access_token,
        session.user.id,
      );
      if (!nextSessionId) return;

      const now = Date.now();
      const sessionChanged = nextSessionId !== currentSessionId;
      currentSessionId = nextSessionId;
      currentAccessToken = session.access_token;
      currentRefreshToken = session.refresh_token;
      authenticated = true;

      const logoutMarker = parseWebSessionLogoutMarker(
        readStorage(WEB_SESSION_LOGOUT_STORAGE_KEY),
        now,
      );
      const pendingLogoutMarker = pendingLogoutMarkers.get(currentSessionId);
      const storedLogoutMarker =
        logoutMarker?.sessionId === currentSessionId ? logoutMarker : null;
      const applicableLogoutMarker =
        pendingLogoutMarker &&
        (!storedLogoutMarker ||
          pendingLogoutMarker.loggedOutAt >= storedLogoutMarker.loggedOutAt)
          ? pendingLogoutMarker
          : storedLogoutMarker;
      if (
        applicableLogoutMarker &&
        applyLogoutMarker(applicableLogoutMarker, true)
      ) {
        return;
      }

      const idleLock = parseWebSessionIdleLock(
        readStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY),
        now,
      );
      const stored = storedActivity(now);
      if (
        idleLock &&
        webSessionIdleLockApplies(
          idleLock,
          stored || activity,
          currentSessionId,
        )
      ) {
        beginIdleLogout();
        return;
      }
      if (idleLock?.sessionId === currentSessionId) {
        removeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY);
      }

      if (sessionChanged) {
        if (stored?.sessionId === currentSessionId) {
          activity = stored;
          lastPersistedAt = stored.lastActivityAt;
        } else {
          // Existing sessions receive a one-time grace period on first rollout;
          // subsequent reloads retain the same session-bound timestamp.
          removeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY);
          persistActivity(now);
        }
      } else {
        adoptNewerStoredActivity(now);
      }

      checkExpiry(now);
    }

    function clearEndedSession() {
      const endedSessionId = currentSessionId;
      const now = Date.now();
      const idleLock = parseWebSessionIdleLock(
        readStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY),
        now,
      );
      adoptNewerStoredActivity(now);
      if (
        !logoutInFlight &&
        endedSessionId &&
        idleLock &&
        webSessionIdleLockApplies(idleLock, activity, endedSessionId)
      ) {
        beginIdleLogout();
        return;
      }

      clearTimer();
      clearActivityFlushTimer();
      authenticated = false;
      currentSessionId = "";
      currentAccessToken = "";
      currentRefreshToken = "";
      activity = null;
      lastPersistedAt = 0;

      const stored = storedActivity(now);
      if (stored?.sessionId === endedSessionId) {
        removeStorage(WEB_SESSION_ACTIVITY_STORAGE_KEY);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return;
      if (session) establishSession(session);
      else clearEndedSession();
    });

    function handleVisibilityCheck() {
      if (document.visibilityState === "visible") handleLifecycleCheck();
      else flushActivity();
    }

    function handleLifecycleCheck() {
      if (enforcePersistedLogoutMarker()) return;
      checkExpiry();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === WEB_SESSION_LOGOUT_STORAGE_KEY) {
        const marker = parseWebSessionLogoutMarker(event.newValue, Date.now());
        if (marker) applyLogoutMarker(marker, true);
        return;
      }

      if (event.key === supabaseAuthStorageKey) {
        enforcePersistedLogoutMarker();
        return;
      }

      if (!authenticated || logoutInFlight) return;

      if (event.key === WEB_SESSION_ACTIVITY_STORAGE_KEY) {
        const stored = parseWebSessionActivity(event.newValue, Date.now());
        if (
          stored?.sessionId === currentSessionId &&
          (!activity || stored.lastActivityAt > activity.lastActivityAt)
        ) {
          activity = stored;
          lastPersistedAt = stored.lastActivityAt;
          checkExpiry();
        }
        return;
      }

      if (event.key === WEB_SESSION_IDLE_LOCK_STORAGE_KEY) {
        const idleLock = parseWebSessionIdleLock(event.newValue, Date.now());
        adoptNewerStoredActivity(Date.now());
        if (
          idleLock &&
          webSessionIdleLockApplies(
            idleLock,
            activity,
            currentSessionId,
          )
        ) {
          beginIdleLogout();
        } else if (idleLock?.sessionId === currentSessionId) {
          removeStorage(WEB_SESSION_IDLE_LOCK_STORAGE_KEY);
        }
      }
    }

    function handleLocalLogout(event: Event) {
      if (!(event instanceof CustomEvent)) return;

      let marker: WebSessionLogoutMarker | null = null;
      try {
        marker = parseWebSessionLogoutMarker(
          JSON.stringify(event.detail),
          Date.now(),
        );
      } catch {
        marker = null;
      }
      if (marker) applyLogoutMarker(marker, false);
    }

    function enforcePersistedLogoutMarker() {
      const marker = parseWebSessionLogoutMarker(
        readStorage(WEB_SESSION_LOGOUT_STORAGE_KEY),
        Date.now(),
      );
      return marker ? applyLogoutMarker(marker, true) : false;
    }

    function applyLogoutMarker(
      marker: WebSessionLogoutMarker,
      navigate: boolean,
    ) {
      const persistedSession = readPersistedSupabaseBrowserSession();
      const persistedSessionId = resolveWebSessionId(
        persistedSession.accessToken,
      );
      const target = resolveWebSessionLogoutTarget(
        marker.sessionId,
        currentSessionId,
        persistedSessionId,
        persistedSession.hasStoredSession,
      );
      const duplicatesActiveMarker = Boolean(
        activeLogoutMarker &&
          activeLogoutMarker.sessionId === marker.sessionId &&
          activeLogoutMarker.loggedOutAt === marker.loggedOutAt &&
          activeLogoutMarker.reason === marker.reason,
      );
      if (!duplicatesActiveMarker) rememberLogoutMarker(marker);
      if (logoutInFlight) return target !== "none";
      if (target === "none") return false;

      clearLegacySensitiveClientStorage();
      pendingLogoutMarkers.delete(marker.sessionId);
      activeLogoutMarker = marker;
      logoutInFlight = true;
      authenticated = false;
      clearTimer();
      clearActivityFlushTimer();
      setLocked(marker.reason === "idle");

      if (!navigate) return true;

      void completePersistedLogoutMarker(marker);
      return true;
    }

    async function completePersistedLogoutMarker(
      marker: WebSessionLogoutMarker,
    ) {
      // Storage events for a marker and a newly authenticated session can be
      // delivered in separate turns. Let the pair settle, then re-read under
      // Supabase's own auth-storage lock before deleting any credentials.
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, crossTabLogoutSettlementDelayMs),
      );
      if (disposed) return;

      const persistedSession = readPersistedSupabaseBrowserSession();
      const persistedSessionId = resolveWebSessionId(
        persistedSession.accessToken,
      );
      const target = resolveWebSessionLogoutTarget(
        marker.sessionId,
        currentSessionId,
        persistedSessionId,
        persistedSession.hasStoredSession,
      );
      const replacementMarker = selectReplacementWebSessionLogoutMarker(
        marker,
        [
          ...pendingLogoutMarkers.values(),
          parseWebSessionLogoutMarker(
            readStorage(WEB_SESSION_LOGOUT_STORAGE_KEY),
            Date.now(),
          ),
        ],
        currentSessionId,
        persistedSessionId,
        persistedSession.hasStoredSession,
      );
      if (replacementMarker) {
        logoutInFlight = false;
        activeLogoutMarker = null;
        if (applyLogoutMarker(replacementMarker, true)) return;
      }

      if (target === "none") {
        logoutInFlight = false;
        activeLogoutMarker = null;
        authenticated = Boolean(currentSessionId);
        setLocked(false);
        scheduleExpiryCheck();
        return;
      }

      const accessToken =
        target === "persisted"
          ? persistedSession.accessToken
          : currentAccessToken;
      const refreshToken =
        target === "persisted"
          ? persistedSession.refreshToken
          : currentRefreshToken;

      if (target === "current-preserve") {
        requestSupabaseBrowserSessionRevocation(accessToken, refreshToken);
        window.location.reload();
        return;
      }

      const cleared = await terminatePersistedSupabaseBrowserSession(
        accessToken,
        refreshToken,
        marker.sessionId,
      );
      if (!cleared) {
        window.location.reload();
        return;
      }

      const redirectHref =
        marker.reason === "idle"
          ? buildIdleLoginHref(
              window.location.pathname,
              window.location.search,
            )
          : "/login";
      window.location.replace(redirectHref);
    }

    for (const eventName of activityEvents) {
      document.addEventListener(eventName, recordActivity, {
        capture: true,
        passive: eventName !== "keydown",
      });
    }
    document.addEventListener("scroll", recordActivity, {
      capture: true,
      passive: true,
    });
    document.addEventListener("visibilitychange", handleVisibilityCheck);
    window.addEventListener("focus", handleLifecycleCheck);
    window.addEventListener("pageshow", handleLifecycleCheck);
    window.addEventListener("pagehide", flushActivity);
    window.addEventListener("online", handleLifecycleCheck);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(WEB_SESSION_LOGOUT_EVENT, handleLocalLogout);

    return () => {
      disposed = true;
      clearTimer();
      clearActivityFlushTimer();
      subscription.unsubscribe();
      for (const eventName of activityEvents) {
        document.removeEventListener(eventName, recordActivity, true);
      }
      document.removeEventListener("scroll", recordActivity, true);
      document.removeEventListener("visibilitychange", handleVisibilityCheck);
      window.removeEventListener("focus", handleLifecycleCheck);
      window.removeEventListener("pageshow", handleLifecycleCheck);
      window.removeEventListener("pagehide", flushActivity);
      window.removeEventListener("online", handleLifecycleCheck);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(WEB_SESSION_LOGOUT_EVENT, handleLocalLogout);
    };
  }, []);

  if (!locked) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed inset-0 z-[2147483647] grid place-items-center bg-[#071631] px-6 text-white"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
        <LockKeyhole className="mx-auto h-12 w-12 text-cyan-200" aria-hidden />
        <h2 className="mt-5 text-2xl font-semibold">
          {language === "tr"
            ? "Oturumunuz güvenle kapatılıyor"
            : "Your session is being secured"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-cyan-50/85">
          {language === "tr"
            ? "2 saat işlem yapılmadığı için yeniden giriş yapmanız gerekiyor."
            : "You need to sign in again after 2 hours without activity."}
        </p>
      </div>
    </div>
  );
}
