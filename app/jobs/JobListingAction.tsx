"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  isMarketplaceAccountRole,
  type MarketplaceAccountRole,
} from "../lib/marketplaceCapabilities";
import { supabase } from "../lib/supabase";

export type JobListingViewer =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; role: MarketplaceAccountRole | null };

export type JobListingAction = {
  detailHref: string;
  href: string;
  intent: "apply" | "signup" | "view";
  label: string;
};

export function useJobListingViewer(): JobListingViewer {
  const [viewer, setViewer] = useState<JobListingViewer>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    let viewerRequest = 0;

    async function resolveViewer(session: Session | null) {
      const request = ++viewerRequest;
      if (!session) {
        if (active) setViewer({ kind: "signed-out" });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role?: string | null }>();

      if (!active || request !== viewerRequest) return;
      const role = !error && isMarketplaceAccountRole(data?.role)
        ? data.role
        : null;
      setViewer({ kind: "signed-in", role });
    }

    void supabase.auth.getSession().then(({ data }) => {
      void resolveViewer(data.session);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void resolveViewer(session);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return viewer;
}

export function getJobListingAction(
  jobId: string,
  viewer: JobListingViewer,
  language: "en" | "tr",
): JobListingAction {
  const detailHref = `/jobs/${encodeURIComponent(jobId)}`;
  const applyHref = `${detailHref}#apply`;

  if (viewer.kind === "signed-out") {
    return {
      detailHref,
      href: `/login?mode=signup&role=crew&next=${encodeURIComponent(applyHref)}`,
      intent: "signup",
      label: language === "tr" ? "Başvurmak için kaydol" : "Sign up to apply",
    };
  }

  if (
    viewer.kind === "signed-in" &&
    (viewer.role === "crew" || viewer.role === "captain")
  ) {
    return {
      detailHref,
      href: applyHref,
      intent: "apply",
      label: language === "tr" ? "Başvur" : "Apply",
    };
  }

  return {
    detailHref,
    href: detailHref,
    intent: "view",
    label: language === "tr" ? "İlanı görüntüle" : "View role",
  };
}
