import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, ShieldCheck } from "lucide-react";
import { BlueDeckLogoLink } from "./BlueDeckLogo";

const publicNavigation = [
  { label: "Yachts", href: "/#yacht-platform" },
  { label: "Services", href: "/services" },
  { label: "Management", href: "/management" },
  { label: "Trust", href: "/trust" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function PublicHeader() {
  return (
    <header className="bd-public-header">
      <div className="mx-auto flex h-[92px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <BlueDeckLogoLink
          href="/"
          priority
          className="h-16 w-52 shrink-0 rounded-none border-0 bg-transparent shadow-none sm:h-[74px] sm:w-64"
          imageClassName="object-contain p-0"
        />

        <nav className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.18em] text-white/72 xl:flex">
          {publicNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="bd-focus transition hover:text-cyan-200">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="bd-focus rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white/82 transition hover:border-cyan-200 hover:text-white"
          >
            Login
          </Link>
          <Link
            href="/login?mode=signup"
            className="bd-focus rounded-full bg-white px-5 py-3 text-sm font-black text-[#07182d] shadow-xl shadow-cyan-950/20 transition hover:bg-cyan-100"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bd-public-footer border-t border-[#071f3c]/10 bg-[#06172b] text-white">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr] lg:px-12">
        <div>
          <BlueDeckLogoLink
            href="/"
            className="h-16 w-56 rounded-none border-0 bg-transparent shadow-none"
            imageClassName="object-contain p-0"
          />
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/62">
            BlueDeck is a private yacht management platform for owners, captains,
            crew operations, documents, contracts and readiness workflows.
          </p>
        </div>

        <FooterColumn
          title="Company"
          links={[
            ["About", "/about"],
            ["Vision", "/about#vision"],
            ["Services", "/services"],
            ["Contact", "/contact"],
          ]}
        />
        <FooterColumn
          title="Platform"
          links={[
            ["Yachts", "/#yacht-platform"],
            ["Management", "/management"],
            ["Trust", "/trust"],
            ["Client login", "/login"],
          ]}
        />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Contact</p>
          <div className="mt-5 space-y-4 text-sm text-white/68">
            <a href="mailto:info@bluedeck.app" className="flex items-center gap-3 transition hover:text-white">
              <Mail className="h-4 w-4 text-cyan-200" />
              info@bluedeck.app
            </a>
            <p className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-cyan-200" />
              Private yacht operations
            </p>
            <p className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              Account-based secure access
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-5 text-xs text-white/50 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} BlueDeck. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">{title}</p>
      <div className="mt-5 grid gap-3 text-sm text-white/68">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex items-center gap-2 transition hover:text-white">
            {label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PublicPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bd-site-shell min-h-screen pt-[92px] text-[#071f3c]">
      <PublicHeader />
      <section className="mx-auto max-w-[1500px] px-5 pb-14 pt-16 sm:px-8 lg:px-12 lg:pt-24">
        <p className="bd-kicker">{eyebrow}</p>
        <h1 className="bd-serif mt-5 max-w-5xl text-5xl leading-[1.02] text-[#071f3c] sm:text-7xl">
          {title}
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[#5b7088]">{intro}</p>
      </section>
      {children}
      <PublicFooter />
    </main>
  );
}
