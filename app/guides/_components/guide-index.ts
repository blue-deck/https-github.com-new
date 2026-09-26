export type GuideSummary = {
  slug: string;
  category: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  minutes: number;
  date: string;
  publishedAt: string;
};

export const guideBase = "/guides";

export const guideHref = (slug: string) => `${guideBase}/${slug}`;

// Card metadata is independent of article bodies, so listing pages stay small.
export const guideSummaries: GuideSummary[] = [
  {
    slug: "ilk-yat-isine-hazirlik",
    category: "Kariyer",
    title: "İlk yat işine giden yol: nereden başlamalı?",
    description:
      "Doğru rolü seçmekten ilk görüşmeye kadar, denizdeki kariyerinin ilk adımlarını daha bilinçli at.",
    image: "/media/guides/yacht-career-v1.webp",
    imageAlt: "Turkuaz Akdeniz sularında ilerleyen beyaz bir motor yata yukarıdan bakış",
    minutes: 3,
    date: "26 Eylül 2026",
    publishedAt: "2026-09-26T09:00:00+03:00",
  },
  {
    slug: "crew-cv-hazirlama",
    category: "CV & Profil",
    title: "Seni doğru anlatan bir crew CV’si hazırla.",
    description:
      "Net bir giriş, somut deneyimler ve doğru bir bilgi sırası. CV’ni başvuracağın role göre yeniden düşün.",
    image: "/media/guides/yacht-bridge-v1.webp",
    imageAlt: "Geniş pencerelerinden deniz görünen bir yatın modern köprüüstü",
    minutes: 3,
    date: "26 Eylül 2026",
    publishedAt: "2026-09-26T09:00:00+03:00",
  },
  {
    slug: "teknede-ilk-hafta",
    category: "Teknede yaşam",
    title: "Teknede ilk hafta: ekibin ritmini yakalamak.",
    description:
      "Yeni bir ortam, yeni bir ekip, ortak bir düzen. İlk günlerini kolaylaştıracak küçük ama önemli alışkanlıklar.",
    image: "/media/guides/yacht-windlass-v1.webp",
    imageAlt: "Tik güvertede güneş ışığını yansıtan parlak paslanmaz çelik yat ırgatı ve çapa zinciri",
    minutes: 3,
    date: "26 Eylül 2026",
    publishedAt: "2026-09-26T09:00:00+03:00",
  },
];

export function getGuideSummary(slug: string): GuideSummary {
  const summary = guideSummaries.find((guide) => guide.slug === slug);
  if (!summary) throw new Error(`Missing guide summary: ${slug}`);
  return summary;
}
