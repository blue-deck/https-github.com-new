"use client";

import { PublicHeader } from "./PublicSiteChrome";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

// Private workspace styling remains scoped; navigation is shared by every route.
const authenticatedAppRoutePrefixes = [
  "/admin",
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

  return <PublicHeader />;
}
