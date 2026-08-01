"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Users,
} from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { translatePhrase } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string) {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export default function YachtAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const { language } = useLanguage();
  const yachtId = String(params?.id || "");
  const [sessionStatus, setSessionStatus] = useState<"checking" | "ready" | "error">("checking");
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      setSessionStatus((current) => current === "ready" ? current : "checking");

      try {
        const {
          data: { session },
          error,
        } = await withTimeout(
          supabase.auth.getSession(),
          12000,
          "Session verification timed out.",
        );

        if (!active) return;
        if (error) throw error;

        if (!session) {
          const returnPath =
            window.location.pathname || (yachtId ? `/yachts/${yachtId}` : "/yachts");
          window.location.replace(
            `/login?next=${encodeURIComponent(returnPath)}`,
          );
          return;
        }

        setSessionStatus("ready");
      } catch (error) {
        console.error("Yacht workspace session verification failed", error);
        if (!active) return;

        setSessionStatus("error");
      }
    }

    void verifyAccess();

    return () => {
      active = false;
    };
  }, [pathname, verificationAttempt, yachtId]);

  const nav = [
    { label: translatePhrase("Overview", language), href: `/yachts/${yachtId}`, icon: Home },
    { label: translatePhrase("Checklist", language), href: `/yachts/${yachtId}/checklists`, icon: ClipboardList },
    { label: translatePhrase("Crew", language), href: `/yachts/${yachtId}/crew`, icon: Users },
  ];
  const isActive = (href: string) =>
    href === `/yachts/${yachtId}`
      ? pathname === href
      : pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  if (sessionStatus === "error") {
    return (
      <main className="bd-app-page min-h-screen px-5 py-16 text-[#071f3c] sm:px-8 lg:px-12">
        <div
          className="mx-auto max-w-3xl rounded-[32px] border border-rose-200 bg-white p-7 shadow-xl shadow-cyan-950/5 sm:p-10"
          role="alert"
        >
          <p className="bd-kicker">BlueDeck Secure Access</p>
          <h1 className="bd-serif mt-4 text-4xl sm:text-5xl">
            {language === "tr" ? "Oturum doğrulanamadı" : "Session verification failed"}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            {language === "tr"
              ? "Oturumunuz doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin."
              : "We could not verify your session. Check your connection and try again."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setVerificationAttempt((current) => current + 1)}
              className="bd-focus rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-cyan-800"
            >
              {language === "tr" ? "Yeniden dene" : "Try again"}
            </button>
            <Link
              href="/yachts"
              className="bd-focus rounded-2xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800 transition hover:border-cyan-400"
            >
              {language === "tr" ? "Filoya dön" : "Back to fleet"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (sessionStatus === "checking") {
    return (
      <main
        className="bd-app-page min-h-screen px-5 py-16 text-[#071f3c] sm:px-8 lg:px-12"
        aria-busy="true"
      >
        <div className="mx-auto max-w-[1500px]">
          <p className="bd-kicker">BlueDeck Secure Access</p>
          <h1 className="bd-serif mt-4 text-4xl sm:text-5xl" role="status">
            {language === "tr"
              ? "Özel yacht çalışma alanı açılıyor..."
              : "Opening private yacht workspace..."}
          </h1>
        </div>
      </main>
    );
  }

  return (
    <div className="bd-yacht-portal min-h-screen text-slate-900">
      <div className="bd-main-column">
        <nav
          aria-label={language === "tr" ? "Yat çalışma alanı" : "Yacht workspace"}
          className="bd-yacht-section-nav sticky z-40 border-b border-[#071f3c]/10 bg-white shadow-sm"
        >
          <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-4 sm:px-8 lg:px-12">
            <div className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`bd-focus inline-flex min-w-fit items-center gap-2 border-b-2 px-1 py-2 text-sm font-black uppercase tracking-[0.12em] transition ${
                      active
                        ? "border-cyan-700 text-[#071f3c]"
                        : "border-transparent text-[#5b7088] hover:border-cyan-300 hover:text-[#071f3c]"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="bd-yacht-page-content bd-private-workspace">{children}</div>
      </div>
    </div>
  );
}
