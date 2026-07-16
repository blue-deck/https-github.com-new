"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { BlueDeckTopBar } from "./BlueDeckTopBar";

const authenticatedPaths = [
  "/applications",
  "/contracts",
  "/crew/tasks",
  "/dashboard",
  "/hiring",
  "/my-blue",
  "/portal",
  "/profile",
  "/settings",
  "/yachts",
];

function usesAuthenticatedTopBar(pathname: string) {
  return authenticatedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function AuthenticatedTopBar() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [checked, setChecked] = useState(false);

  const shouldShowForRoute = useMemo(
    () => usesAuthenticatedTopBar(pathname || "/"),
    [pathname],
  );

  useEffect(() => {
    let active = true;

    function reflectSession(session: unknown) {
      const authenticated = Boolean(session);
      setHasSession(authenticated);
      setChecked(true);
      document.documentElement.toggleAttribute("data-authenticated", authenticated);
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      reflectSession(session);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      reflectSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      document.documentElement.removeAttribute("data-authenticated");
    };
  }, []);

  if (!checked || !hasSession || !shouldShowForRoute) return null;

  return <BlueDeckTopBar />;
}
