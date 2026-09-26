import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteSiteUrl } from "../../lib/site";
import { GuideArticle } from "../_components/GuideArticle";
import { getGuide, guides } from "../_components/guide-data";
import { guideHref } from "../_components/guide-index";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides.find((item) => item.slug === slug);
  if (!guide) notFound();
  const title = `${guide.title} | BlueDeck Blog`;
  return {
    title,
    description: guide.description,
    alternates: { canonical: guideHref(slug) },
    openGraph: {
      title, description: guide.description, url: guideHref(slug), siteName: "BlueDeck",
      type: "article", locale: "en_US", publishedTime: guide.publishedAt,
      modifiedTime: guide.publishedAt, authors: ["BlueDeck Blog"], section: guide.category,
      images: [{ url: guide.image, width: 1440, height: 960, alt: guide.imageAlt }],
    },
    twitter: { card: "summary_large_image", title, description: guide.description, images: [guide.image] },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = guides.find((item) => item.slug === slug);
  const turkishGuide = getGuide(slug, "tr");
  if (!guide || !turkishGuide) notFound();
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: guide.title,
    description: guide.description,
    image: absoluteSiteUrl(guide.image),
    datePublished: guide.publishedAt,
    dateModified: guide.publishedAt,
    author: { "@type": "Organization", name: "BlueDeck Blog", url: absoluteSiteUrl("/blog") },
    publisher: { "@type": "Organization", name: "BlueDeck", url: absoluteSiteUrl() },
    mainEntityOfPage: absoluteSiteUrl(guideHref(slug)),
    inLanguage: "en",
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article).replace(/</g, "\\u003c") }} /><GuideArticle translations={{ en: guide, tr: turkishGuide }} /></>;
}
