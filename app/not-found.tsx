import Link from "next/link";
import { Compass } from "lucide-react";
import { PublicFooter, PublicHeader } from "./components/PublicSiteChrome";

export default function NotFound() {
  return (
    <main className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />
      <section className="mx-auto flex min-h-[calc(100dvh-var(--public-header-height))] max-w-3xl items-center px-5 py-16 text-center sm:px-8">
        <div className="bd-editorial-card w-full p-8 sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#07182d] text-cyan-200">
            <Compass className="h-8 w-8" />
          </div>
          <p className="bd-kicker mt-7">BlueDeck Navigation</p>
          <h1 className="bd-serif mt-4 text-5xl leading-tight text-[#071f3c]">
            This page is not available.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#5b7088]">
            The address may be wrong, expired, or private to a signed-in account.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="bd-primary-cta">
              BlueDeck home
            </Link>
            <Link href="/login" className="bd-secondary-cta">
              Login
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
