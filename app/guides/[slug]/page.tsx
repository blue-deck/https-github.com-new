import { notFound, permanentRedirect } from "next/navigation";
import { guideHref, guideSummaries, legacyGuideSlugs } from "../../blog/_components/guide-index";

export function generateStaticParams() {
  return Object.keys(legacyGuideSlugs).map((slug) => ({ slug }));
}

export default async function LegacyGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const canonicalSlug = Object.entries(legacyGuideSlugs).find(([legacy]) => legacy === slug)?.[1] ?? slug;
  if (!guideSummaries.some((guide) => guide.slug === canonicalSlug)) notFound();
  permanentRedirect(guideHref(canonicalSlug));
}
