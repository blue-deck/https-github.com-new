"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  marketplaceCapabilitiesForRole,
  marketplaceRoleLabel,
  normalizeMarketplaceAccountRole,
  type MarketplaceCapabilities,
} from "../lib/marketplaceCapabilities";
import type { VerifiedEmployerYacht } from "../lib/jobPosts";
import { supabase } from "../lib/supabase";

type JobWorkspaceResponse = {
  ok?: boolean;
  error?: string;
  capabilities?: MarketplaceCapabilities & {
    postingStatus?: "enabled" | "suspended" | "unavailable";
    planCode?: string;
  };
  yachts?: VerifiedEmployerYacht[];
};

const copy = {
  en: {
    eyebrow: "BlueDeck marketplace",
    title: "Hiring & job access",
    intro:
      "Captain, Owner / Employer and Management accounts can create, publish and manage job posts directly.",
    privacy: "Private account area",
    loading: "Loading hiring access…",
    loadError: "Hiring access could not be loaded.",
    retry: "Try again",
    directEyebrow: "Self-service job posting",
    directTitle: "No administrator approval",
    directActive:
      "Your account type can create, publish and manage job posts directly for yachts where you hold current marketplace authority.",
    directCrew:
      "Crew accounts can browse and apply to jobs. Choose Captain, Owner / Employer or Management when creating an account to post jobs.",
    directSuspended:
      "Job posting is currently paused for this account. Existing posts remain protected until access is restored.",
    connectedForPosting: "Yachts available for posting",
    manageDirect: "Manage job posts",
    browseJobs: "Browse jobs",
    connectYacht:
      "Connect a real yacht first: owners register their yacht; captains and management use an active, role-appropriate yacht membership.",
    captainDual:
      "Captain accounts can also browse and apply to jobs with the same account.",
  },
  tr: {
    eyebrow: "BlueDeck marketplace",
    title: "İşe alım ve ilan yetkisi",
    intro:
      "Captain, Owner / Employer ve Management hesapları iş ilanlarını doğrudan oluşturabilir, yayınlayabilir ve yönetebilir.",
    privacy: "Özel hesap alanı",
    loading: "İşe alım yetkisi yükleniyor…",
    loadError: "İşe alım yetkisi yüklenemedi.",
    retry: "Tekrar dene",
    directEyebrow: "Doğrudan iş ilanı yayınlama",
    directTitle: "Yönetici onayı gerektirmez",
    directActive:
      "Hesap türün, güncel marketplace yetkin bulunan yatlar için doğrudan iş ilanı oluşturabilir, yayınlayabilir ve yönetebilir.",
    directCrew:
      "Crew hesapları ilanları görüntüleyip başvurabilir. İlan vermek için hesap oluştururken Captain, Owner / Employer veya Management seçilir.",
    directSuspended:
      "Bu hesap için ilan yayınlama şu anda duraklatılmış. Yetki yeniden açılana kadar mevcut ilanlar korunur.",
    connectedForPosting: "İlan verilebilen yat",
    manageDirect: "İş ilanlarını yönet",
    browseJobs: "İş ilanlarına göz at",
    connectYacht:
      "Önce gerçek bir yat bağlantısı kur: yat sahipleri yatını kaydeder; Captain ve Management hesapları role uygun aktif yat üyeliğini kullanır.",
    captainDual:
      "Captain hesabı aynı zamanda iş ilanlarını görüntüleyip başvuru yapabilir.",
  },
} as const;

export default function HiringPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accountRole, setAccountRole] = useState("crew");
  const [marketplaceCapabilities, setMarketplaceCapabilities] = useState<
    JobWorkspaceResponse["capabilities"]
  >(marketplaceCapabilitiesForRole("crew"));
  const [marketplaceYachtCount, setMarketplaceYachtCount] = useState(0);

  async function loadHiringAccess() {
    setLoading(true);
    setLoadError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/hiring")}`,
      );
      return;
    }

    try {
      const response = await fetch("/api/employer/job-posts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const workspace = (await response
        .json()
        .catch(() => null)) as JobWorkspaceResponse | null;

      if (response.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/hiring")}`,
        );
        return;
      }

      if (!response.ok || !workspace?.ok || !workspace.capabilities) {
        throw new Error(workspace?.error || c.loadError);
      }

      const canonicalRole = normalizeMarketplaceAccountRole(
        workspace.capabilities.role,
      );
      setAccountRole(canonicalRole);
      setMarketplaceCapabilities({
        ...marketplaceCapabilitiesForRole(canonicalRole),
        ...workspace.capabilities,
        role: canonicalRole,
        requiresAdminApproval: false,
      });
      setMarketplaceYachtCount(workspace.yachts?.length || 0);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHiringAccess();
  }, []);

  if (loading) {
    return <LoadingState label={c.loading} />;
  }

  if (loadError) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="bd-ocean-content mx-auto max-w-4xl">
          <div className="bd-glass-card-strong overflow-hidden rounded-[30px]">
            <div className="bd-brand-rule h-1.5" />
            <div className="p-7 sm:p-10">
              <AlertCircle className="h-9 w-9 text-rose-600" aria-hidden />
              <h1 className="mt-5 text-3xl font-semibold text-slate-950">
                {c.loadError}
              </h1>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => void loadHiringAccess()}
                className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {c.retry}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen overflow-x-hidden px-5 pb-24 pt-8 text-slate-900 sm:px-8 sm:pt-10 lg:px-10">
      <div className="bd-ocean-content mx-auto w-full max-w-7xl">
        <section className="bd-page-hero relative overflow-hidden rounded-[34px] border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
          <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="bd-kicker">{c.eyebrow}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                {c.privacy}
              </span>
            </div>
            <h1 className="bd-serif mt-5 text-5xl leading-none text-[#071f3c] sm:text-6xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {c.intro}
            </p>
          </div>

          <div className="mt-9 overflow-hidden rounded-[26px] border border-emerald-200 bg-emerald-50/70 p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {c.directEyebrow}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#071f3c]">
                    {marketplaceRoleLabel(
                      normalizeMarketplaceAccountRole(accountRole),
                      language,
                    )}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">
                  {c.directTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">
                  {marketplaceCapabilities?.postingStatus === "suspended"
                    ? c.directSuspended
                    : marketplaceCapabilities?.canPostJobs
                      ? c.directActive
                      : c.directCrew}
                </p>
                {marketplaceCapabilities?.canPostJobs ? (
                  <p className="mt-3 text-sm font-bold text-emerald-900">
                    {c.connectedForPosting}: {marketplaceYachtCount}
                  </p>
                ) : null}
                {marketplaceCapabilities?.canPostJobs &&
                marketplaceYachtCount === 0 ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {c.connectYacht}
                  </p>
                ) : null}
                {normalizeMarketplaceAccountRole(accountRole) === "captain" ? (
                  <p className="mt-2 text-sm font-semibold text-cyan-900">
                    {c.captainDual}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                {marketplaceCapabilities?.canPostJobs &&
                marketplaceYachtCount > 0 ? (
                  <Link
                    href="/hiring/jobs"
                    className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                  >
                    <BriefcaseBusiness className="h-4 w-4" aria-hidden />
                    {c.manageDirect}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
                {marketplaceCapabilities?.canApplyJobs ? (
                  <Link
                    href="/jobs"
                    className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#071f3c]/15 bg-white px-5 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
                  >
                    {c.browseJobs}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center px-5 py-16 text-slate-900">
      <div className="bd-ocean-content text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100 bg-white text-cyan-800 shadow-lg">
          <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-slate-600">
          {label}
        </p>
      </div>
    </main>
  );
}
