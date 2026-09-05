import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { crewJournalArticles, crewJournalPreviews, getCrewJournalArticle } from "../../lib/crewJournal";
import { absoluteSiteUrl } from "../../lib/site";
import { JournalArticleClient } from "../JournalArticleClient";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return crewJournalArticles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getCrewJournalArticle(slug);
  if (!article) notFound();

  const title = `${article.title.en} | BlueDeck Journal`;
  const url = absoluteSiteUrl(`/journal/${article.slug}`);

  return {
    title,
    description: article.summary.en,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: article.summary.en,
      type: "article",
      url,
      siteName: "BlueDeck",
      images: [{ url: absoluteSiteUrl(article.image), alt: article.title.en }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: article.summary.en,
      images: [absoluteSiteUrl(article.image)],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getCrewJournalArticle(slug);
  if (!article) notFound();

  return (
    <JournalArticleClient
      article={article}
      relatedArticles={crewJournalPreviews.filter((entry) => entry.slug !== article.slug)}
    />
  );
}
