"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { type TranslationKey } from "../lib/i18n";
import { useLanguage } from "../components/LanguageProvider";
import { PublicPageShell } from "../components/PublicSiteChrome";

const workflow = [
  "management.workflow1",
  "management.workflow2",
  "management.workflow3",
  "management.workflow4",
  "management.workflow5",
] satisfies TranslationKey[];

export default function ManagementPage() {
  const { t } = useLanguage();

  return (
    <PublicPageShell
      eyebrow={t("management.eyebrow")}
      title={t("management.title")}
      intro={t("management.intro")}
    >
      <section className="bd-section pt-4">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="bd-editorial-card">
            <p className="bd-kicker">{t("management.model")}</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c]">
              {t("management.modelTitle")}
            </h2>
            <p className="mt-5 leading-8 text-[#5b7088]">
              {t("management.modelText")}
            </p>
          </div>

          <div className="grid gap-4">
            {workflow.map((itemKey) => (
              <div key={itemKey} className="flex items-start gap-4 border-b border-[#071f3c]/10 pb-5">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-cyan-700" />
                <p className="text-lg leading-8 text-[#40566f]">{t(itemKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="bd-deep-card">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">{t("management.workspace")}</p>
          <h2 className="bd-serif mt-4 max-w-4xl text-4xl leading-tight text-white sm:text-6xl">
            {t("management.workspaceTitle")}
          </h2>
          <Link href="/login" className="mt-8 inline-flex items-center gap-3 font-black uppercase tracking-[0.16em] text-cyan-200">
            {t("management.loginWorkspace")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
