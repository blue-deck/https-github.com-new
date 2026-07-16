"use client";

import { useLanguage } from "../components/LanguageProvider";
import { PublicPageShell } from "../components/PublicSiteChrome";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <PublicPageShell
      eyebrow={t("about.eyebrow")}
      title={t("about.title")}
      intro={t("about.intro")}
    >
      <section id="vision" className="bd-section pt-4">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="bd-editorial-card lg:col-span-2">
            <p className="bd-kicker">{t("about.vision")}</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c]">
              {t("about.visionTitle")}
            </h2>
            <p className="mt-5 leading-8 text-[#5b7088]">
              {t("about.visionText")}
            </p>
          </article>
          <article className="bd-editorial-card">
            <p className="bd-kicker">{t("about.mission")}</p>
            <p className="mt-4 text-2xl leading-9 text-[#071f3c]">
              {t("about.missionText")}
            </p>
          </article>
        </div>
      </section>
    </PublicPageShell>
  );
}
