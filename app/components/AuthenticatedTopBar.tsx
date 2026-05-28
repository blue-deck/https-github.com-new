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
  "/login",
  "/management",
  "/offline",
  "/privacy",
  "/services",
  "/signup",
  "/terms",
  "/trust",
];

function isPublicPath(pathname: string) {
  if (publicPaths.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
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

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      setHasSession(Boolean(session));
      setChecked(true);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      setChecked(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!checked || !hasSession || shouldHideForRoute) return null;

  return (
    <>
      <BlueDeckTopBar />
      <div aria-hidden="true" className="h-[92px]" />
    </>
  );
}
