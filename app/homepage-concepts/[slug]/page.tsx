import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConceptPrototype } from "../ConceptPrototype";
import { getHomepageConcept, homepageConcepts } from "../concepts";

type ConceptPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return homepageConcepts.map((concept) => ({ slug: concept.id }));
}

export async function generateMetadata({ params }: ConceptPageProps): Promise<Metadata> {
  const { slug } = await params;
  const concept = getHomepageConcept(slug);

  if (!concept) return {};

  return {
    title: `${concept.number} · ${concept.name}`,
    description: concept.summary,
  };
}

export default async function HomepageConceptPage({ params }: ConceptPageProps) {
  const { slug } = await params;
  const concept = getHomepageConcept(slug);

  if (!concept) notFound();

  return <ConceptPrototype concept={concept} />;
}
