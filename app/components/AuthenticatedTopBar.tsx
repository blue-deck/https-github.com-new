"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

// Keep this as an explicit private-workspace allowlist. Marketing, marketplace,
// auth, invitation and public crew routes retain their own page chrome.
const authenticatedAppRoutePrefixes = [
  "/admin/employer-access",
  "/contracts",
  "/crew/tasks",
  "/dashboard",
  "/hiring",
  "/my-blue",
  "/portal/applications",
  "/profile",
  "/settings",
  "/yachts",
] as const;

export function isAuthenticatedAppRoute(pathname: string) {
  return authenticatedAppRoutePrefixes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function AccountTopBarPlaceholder() {
  return <div className="bd-app-topbar-placeholder" aria-hidden="true" />;
}

const BlueDeckTopBar = dynamic(
  () => import("./BlueDeckTopBar").then((module) => module.BlueDeckTopBar),
  { ssr: false, loading: AccountTopBarPlaceholder },
);

export function AuthenticatedTopBar() {
  const pathname = usePathname() || "/";
  const usesAccountShell = isAuthenticatedAppRoute(pathname);
  const [hasSession, setHasSession] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    function reflectSession(session: unknown) {
      if (!active) return;
      const authenticated = Boolean(session);
      setHasSession(authenticated);
      setChecked(true);
    }

    async function loadSession() {
      const { supabase } = await import("../lib/supabase");
      if (!active) return;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        reflectSession(session);
      });
      unsubscribe = () => subscription.unsubscribe();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      reflectSession(session);
    }

    void loadSession();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-account-shell", usesAccountShell);
    root.toggleAttribute(
      "data-authenticated",
      usesAccountShell && checked && hasSession,
    );

    return () => {
      root.removeAttribute("data-account-shell");
      root.removeAttribute("data-authenticated");
    };
  }, [checked, hasSession, usesAccountShell]);

  if (!usesAccountShell) return null;
  if (!checked) return <AccountTopBarPlaceholder />;
  if (!hasSession) return null;

  return <BlueDeckTopBar />;
}
