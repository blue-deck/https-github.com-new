"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCcw, ShieldAlert } from "lucide-react";
import { isAuthenticatedAppRoute } from "./components/AuthenticatedTopBar";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() || "/";
  const usesAccountShell = isAuthenticatedAppRoute(pathname);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      {!usesAccountShell && <PublicHeader />}
      <main id="main-content">
        <section className="mx-auto flex min-h-[calc(100dvh-var(--public-header-height))] max-w-3xl items-center px-5 py-16 text-center sm:px-8">
          <div className="bd-editorial-card w-full p-8 sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
              <ShieldAlert className="h-8 w-8" aria-hidden />
            </div>
            <p className="bd-kicker mt-7">BlueDeck System</p>
            <h1 className="bd-serif mt-4 text-5xl leading-tight text-[#071f3c]">
              We could not complete this request.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#5b7088]" role="alert">
              We could not load the latest page state. Try again, or return to
              the dashboard and continue from there.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="bd-primary-cta">
                <RefreshCcw className="h-4 w-4" aria-hidden />
                Try again
              </button>
              <Link href="/dashboard" className="bd-secondary-cta">
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
      {!usesAccountShell && <PublicFooter />}
    </div>
  );
}
