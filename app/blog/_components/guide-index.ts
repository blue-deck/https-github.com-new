export type GuideLanguage = "en" | "tr";
export type GuideCategoryId = "career" | "cv-profile" | "onboard-life";

export type GuideSummary = {
  slug: string;
  categoryId: GuideCategoryId;
  category: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  minutes: number;
  date: string;
  publishedAt: string;
};

export const guideBase = "/blog";
export const guideHref = (slug: string) => `${guideBase}/${slug}`;

export const legacyGuideSlugs: Record<string, string> = {
  "ilk-yat-isine-hazirlik": "first-yacht-job",
  "crew-cv-hazirlama": "yacht-crew-cv",
  "teknede-ilk-hafta": "first-week-onboard",
};

// Keep listing metadata separate from article bodies to keep client bundles small.
const englishSummaries: GuideSummary[] = [
  {
    slug: "first-yacht-job",
    categoryId: "career",
    category: "Career",
    title: "Your first yacht job: where to begin.",
    description:
      "From choosing the right role to your first interview, take your first steps towards a career at sea with confidence.",
    image: "/media/guides/yacht-career-v1.webp",
    imageAlt: "Aerial view of a white motor yacht cruising through turquoise Mediterranean waters",
    minutes: 3,
    date: "26 September 2026",
    publishedAt: "2026-09-26T09:00:00+03:00",
  },
  {
    slug: "yacht-crew-cv",
    categoryId: "cv-profile",
    category: "CV & Profile",
    title: "Create a crew CV that tells your story.",
    description:
      "A clear introduction, specific experience and the right information in the right order. Build your CV around the role you want.",
    image: "/media/guides/yacht-bridge-v1.webp",
    imageAlt: "A modern yacht bridge with wide windows overlooking the sea",
    minutes: 3,
    date: "26 September 2026",
    publishedAt: "2026-09-26T09:00:00+03:00",
  },
  {
    slug: "first-week-onboard",
    categoryId: "onboard-life",
    category: "Life on board",
    title: "Your first week on board: finding your rhythm.",
    description:
      "A new setting, a new crew and a shared routine. Small, thoughtful habits that help you settle into life on board.",
    image: "/media/guides/yacht-windlass-v1.webp",
    imageAlt: "A polished stainless steel yacht windlass and anchor chain reflecting sunlight on a teak deck",
    minutes: 3,
    date: "26 September 2026",
    publishedAt: "2026-09-26T09:00:00+03:00",
  },
];

const turkishSummaries: GuideSummary[] = [
  {
    slug: "first-yacht-job",
    categoryId: "career",
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
    slug: "yacht-crew-cv",
    categoryId: "cv-profile",
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
    slug: "first-week-onboard",
    categoryId: "onboard-life",
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

export function getGuideSummaries(language: GuideLanguage = "en"): GuideSummary[] {
  return language === "tr" ? turkishSummaries : englishSummaries;
}

export function getGuideSummary(slug: string, language: GuideLanguage = "en"): GuideSummary {
  const canonicalSlug = legacyGuideSlugs[slug] ?? slug;
  const summary = getGuideSummaries(language).find((guide) => guide.slug === canonicalSlug);
  if (!summary) throw new Error(`Missing guide summary: ${slug}`);
  return summary;
}

export const guideSummaries = getGuideSummaries();
