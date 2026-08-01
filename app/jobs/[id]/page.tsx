import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { loadPublicJobPost } from "../../lib/jobPostsServer";
import { parsePublicJob } from "../job-data";
import { JobDetailClient } from "./JobDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const getPublicJobPost = cache(loadPublicJobPost);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getPublicJobPost(id);
  if (!result.ok && result.status === 404) notFound();

  if (!result.ok) return fallbackMetadata(id);

  const description = metadataDescription(
    result.job.summary || result.job.description,
  );

  return {
    title: `${result.job.position} | Yacht Crew Jobs | BlueDeck`,
    description,
    alternates: {
      canonical: `/jobs/${encodeURIComponent(result.job.id)}`,
    },
    openGraph: {
      title: `${result.job.position} | BlueDeck`,
      description,
      type: "website",
      url: `/jobs/${encodeURIComponent(result.job.id)}`,
    },
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getPublicJobPost(id);
  if (!result.ok && result.status === 404) notFound();

  const initialJob = result.ok ? parsePublicJob(result.job) : null;
  if (result.ok && !initialJob) {
    throw new Error("The public job post could not be rendered.");
  }

  const jobId = result.ok ? result.job.id : id.trim().toLowerCase();
  return (
    <JobDetailClient
      key={jobId}
      jobId={jobId}
      initialJob={initialJob}
    />
  );
}

function fallbackMetadata(id: string): Metadata {
  return {
    title: "Yacht Crew Role | BlueDeck",
    description: "View a current yacht crew opportunity on BlueDeck.",
    alternates: {
      canonical: `/jobs/${encodeURIComponent(id.trim().toLowerCase())}`,
    },
  };
}

function metadataDescription(value: string) {
  const description = value.replace(/\s+/g, " ").trim();
  if (!description) {
    return "View this current yacht crew opportunity and apply securely through BlueDeck.";
  }
  return description.length > 160
    ? `${description.slice(0, 157).trimEnd()}...`
    : description;
}
