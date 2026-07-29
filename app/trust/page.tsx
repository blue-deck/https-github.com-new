"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole, MailCheck, ShieldCheck, UserCheck } from "lucide-react";
import { type TranslationKey } from "../lib/i18n";
import { useLanguage } from "../components/LanguageProvider";
import { PublicPageShell } from "../components/PublicSiteChrome";
import { useJobListingViewer } from "../jobs/JobListingAction";

const trustItems = [
  {
    icon: UserCheck,
    titleKey: "trust.item1.title",
    textKey: "trust.item1.text",
  },
  {
    icon: LockKeyhole,
    titleKey: "trust.item2.title",
    textKey: "trust.item2.text",
  },
  {
    icon: ShieldCheck,
    titleKey: "trust.item3.title",
    textKey: "trust.item3.text",
  },
  {
    icon: MailCheck,
    titleKey: "trust.item4.title",
    textKey: "trust.item4.text",
  },
] satisfies Array<{ icon: typeof UserCheck; titleKey: TranslationKey; textKey: TranslationKey }>;

export default function TrustPage() {
  const { language, t } = useLanguage();
  const viewer = useJobListingViewer();
  const accountAction =
    viewer.kind === "signed-in"
      ? { href: "/dashboard", label: t("topbar.dashboard") }
      : { href: "/login?mode=signup", label: t("home.createAccount") };

  return (
    <PublicPageShell
      eyebrow={t("trust.eyebrow")}
      title={t("trust.title")}
      intro={t("trust.intro")}
    >
      <section className="bd-section pt-4">
        <div className="grid gap-5 md:grid-cols-2">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.titleKey} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h2 className="mt-7 text-2xl font-semibold text-[#071f3c]">{t(item.titleKey)}</h2>
                <p className="mt-4 leading-7 text-[#5b7088]">{t(item.textKey)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bd-public-container pb-20">
        <div className="bd-cta-band">
          <div>
            <p className="bd-kicker">
              {language === "tr" ? "Açık ve anlaşılır" : "Clear by design"}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-[#07182d]">
              {language === "tr"
                ? "Verinizin nasıl kullanıldığını inceleyin."
                : "Review how your information is used."}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/privacy" className="bd-secondary-cta">
              {t("footer.privacy")}
            </Link>
            <Link href={accountAction.href} className="bd-primary-cta">
              {accountAction.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
