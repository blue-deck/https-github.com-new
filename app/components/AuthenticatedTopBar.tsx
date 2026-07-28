"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const BlueDeckTopBar = dynamic(
  () => import("./BlueDeckTopBar").then((module) => module.BlueDeckTopBar),
  { ssr: false },
);

export function AuthenticatedTopBar() {
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
      document.documentElement.toggleAttribute("data-authenticated", authenticated);
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
      document.documentElement.removeAttribute("data-authenticated");
    };
  }, []);

  if (!checked || !hasSession) return null;

  return <BlueDeckTopBar />;
}
