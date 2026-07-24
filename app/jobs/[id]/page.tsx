import type { Metadata } from "next";
import { JobDetailClient } from "./JobDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: "Yacht Crew Role | BlueDeck",
    description: "View a current yacht crew opportunity on BlueDeck.",
    alternates: {
      canonical: `/jobs/${encodeURIComponent(id)}`,
    },
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <JobDetailClient jobId={id} />;
}
