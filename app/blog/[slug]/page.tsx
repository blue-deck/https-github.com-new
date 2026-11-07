import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteSiteUrl } from "../../lib/site";
import { GuideArticle } from "../_components/GuideArticle";
import { guideHref } from "../_components/guide-index";
import { getPublishedPost, getPublishedPosts, publishedGuide, publishedSummaries } from "../_components/published-guides";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  const guide = publishedGuide(post, "en");
  const title = guide.seoTitle || `${guide.title} | BlueDeck Blog`;
  const description = guide.seoDescription || guide.description;
  return {
    title,
    description,
    alternates: { canonical: guideHref(slug) },
    openGraph: {
      title, description, url: guideHref(slug), siteName: "BlueDeck",
      type: "article", locale: guide.language === "tr" ? "tr_TR" : "en_US", publishedTime: guide.publishedAt,
      modifiedTime: post.publishedUpdatedAt ?? guide.publishedAt, authors: [guide.author], section: guide.category,
      images: [{ url: guide.image, alt: guide.imageAlt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [guide.image] },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const [post, posts] = await Promise.all([getPublishedPost(slug), getPublishedPosts()]);
  if (!post) notFound();
  const guide = publishedGuide(post, "en");
  const turkishGuide = publishedGuide(post, "tr");
  const related = posts.filter((item) => item.id !== post.id).slice(0, 2);
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: guide.title,
    description: guide.description,
    image: guide.image.startsWith("https://") ? guide.image : absoluteSiteUrl(guide.image),
    datePublished: guide.publishedAt,
    dateModified: post.publishedUpdatedAt ?? guide.publishedAt,
    author: { "@type": guide.author === "BlueDeck Blog" ? "Organization" : "Person", name: guide.author },
    publisher: { "@type": "Organization", name: "BlueDeck", url: absoluteSiteUrl() },
    mainEntityOfPage: absoluteSiteUrl(guideHref(slug)),
    inLanguage: guide.language,
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article).replace(/</g, "\\u003c") }} /><GuideArticle translations={{ en: guide, tr: turkishGuide }} relatedTranslations={publishedSummaries(related)} updatedAt={post.publishedUpdatedAt} /></>;
}
