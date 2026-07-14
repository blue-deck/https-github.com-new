"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { BlueDeckTopBar } from "./BlueDeckTopBar";

const publicPaths = [
  "/",
  "/about",
  "/auth",
  "/auth/confirm",
  "/contact",
  "/forgot-password",
  "/login",
  "/management",
  "/offline",
  "/privacy",
  "/reset-password",
  "/services",
  "/signup",
  "/terms",
  "/trust",
];

function isPublicPath(pathname: string) {
  if (publicPaths.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/yachts/")) return true;
  return false;
}

export function AuthenticatedTopBar() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [checked, setChecked] = useState(false);

  const shouldHideForRoute = useMemo(
    () => isPublicPath(pathname || "/"),
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

  if (!checked || !hasSession || shouldHideForRoute) return null;

  return <BlueDeckTopBar />;
}
