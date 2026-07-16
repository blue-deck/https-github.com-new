"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  Database,
  LockKeyhole,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { type TranslationKey } from "../lib/i18n";
import { useLanguage } from "../components/LanguageProvider";
import { PublicPageShell } from "../components/PublicSiteChrome";

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

const recruitmentTrustCopy = {
  en: {
    eyebrow: "Recruitment Safety",
    title: "Professional hiring needs visible safeguards.",
    intro:
      "BlueDeck separates professional profile data from private information, limits what employers should use, and treats verification as a review rather than a guarantee.",
    items: [
      {
        icon: BriefcaseBusiness,
        title: "Purpose-Limited Applications",
        text: "Candidate information should be opened and used only for a genuine role, lawful hiring review and authorized onboarding.",
      },
      {
        icon: BadgeCheck,
        title: "Verification With Context",
        text: "An employer review or badge means supplied details were checked at that time. It does not guarantee conduct, payment or working conditions.",
      },
      {
        icon: Database,
        title: "Data Minimization",
        text: "Public crew pages show a professional summary. Private contact, identity, medical and document details are not intended for unrestricted display.",
      },
      {
        icon: ShieldAlert,
        title: "Scam Red Flags",
        text: "Never pay to secure an interview or placement, and never send passwords, banking credentials or sensitive identity files to an unverified requester.",
      },
    ],
  },
  tr: {
    eyebrow: "İşe Alım Güvenliği",
    title: "Profesyonel işe alım görünür güvenlik önlemleri gerektirir.",
    intro:
      "BlueDeck profesyonel profil verilerini özel bilgilerden ayırır, işveren kullanımını amaçla sınırlar ve doğrulamayı bir garanti değil inceleme olarak ele alır.",
    items: [
      {
        icon: BriefcaseBusiness,
        title: "Amaçla Sınırlı Başvurular",
        text: "Aday bilgileri yalnızca gerçek bir pozisyon, hukuka uygun işe alım değerlendirmesi ve yetkili onboarding için açılmalı ve kullanılmalıdır.",
      },
      {
        icon: BadgeCheck,
        title: "Bağlamıyla Doğrulama",
        text: "İşveren incelemesi veya rozeti, sunulan bilgilerin o tarihte kontrol edildiğini gösterir; davranış, ödeme veya çalışma koşulu garantisi değildir.",
      },
      {
        icon: Database,
        title: "Veri Minimizasyonu",
        text: "Public mürettebat sayfaları profesyonel bir özet gösterir. Özel iletişim, kimlik, sağlık ve belge bilgileri sınırsız gösterim için değildir.",
      },
      {
        icon: ShieldAlert,
        title: "Dolandırıcılık İşaretleri",
        text: "Görüşme veya işe yerleşme için para ödemeyin; doğrulanmamış kişilere şifre, banka bilgisi veya hassas kimlik belgesi göndermeyin.",
      },
    ],
  },
} as const;

export default function TrustPage() {
  const { language, t } = useLanguage();
  const recruitment = recruitmentTrustCopy[language] || recruitmentTrustCopy.en;

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

      <section className="bd-deep-band">
        <div className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-200">
            {recruitment.eyebrow}
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <h2 className="bd-serif max-w-4xl text-4xl leading-tight text-white sm:text-6xl">
              {recruitment.title}
            </h2>
            <p className="max-w-3xl text-lg leading-8 text-white/68">
              {recruitment.intro}
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {recruitment.items.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-white/12 bg-white/[0.07] p-6 shadow-2xl shadow-slate-950/16 backdrop-blur"
                >
                  <Icon className="h-7 w-7 text-cyan-200" />
                  <h3 className="mt-5 text-2xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 leading-7 text-white/68">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
