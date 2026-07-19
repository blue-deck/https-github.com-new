"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { BlueDeckTopBar } from "./BlueDeckTopBar";

export function AuthenticatedTopBar() {
  const [hasSession, setHasSession] = useState(false);
  const [checked, setChecked] = useState(false);

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

  if (!checked || !hasSession) return null;

  return <BlueDeckTopBar />;
}
