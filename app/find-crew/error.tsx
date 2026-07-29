"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCcw, UsersRound } from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";

export default function FindCrewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { language } = useLanguage();

  useEffect(() => {
    console.error("Find Crew page failed", error);
  }, [error]);

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content">
        <section className="mx-auto flex min-h-[calc(100dvh-var(--public-header-height))] max-w-3xl items-center px-5 py-16 text-center sm:px-8">
          <div className="bd-editorial-card w-full p-8 sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
              <UsersRound className="h-8 w-8" aria-hidden />
            </div>
            <p className="bd-kicker mt-7">
              {language === "tr" ? "Mürettebat ağı" : "Crew network"}
            </p>
            <h1 className="bd-serif mt-4 text-5xl leading-tight text-[#071f3c]">
              {language === "tr"
                ? "Profiller şu anda yüklenemiyor."
                : "Crew profiles are temporarily unavailable."}
            </h1>
            <p
              className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#5b7088]"
              role="alert"
            >
              {language === "tr"
                ? "Bu bir boş sonuç değil. Bağlantıyı yeniden denemek için tekrar yükleyin."
                : "This is not an empty result. Retry the connection to load the crew network."}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="bd-primary-cta">
                <RefreshCcw className="h-4 w-4" aria-hidden />
                {language === "tr" ? "Tekrar dene" : "Try again"}
              </button>
              <Link href="/" className="bd-secondary-cta">
                {language === "tr" ? "Ana sayfa" : "BlueDeck home"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
