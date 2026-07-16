import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { notFound } from "next/navigation";
import { JobDetailView } from "@/app/components/jobs/JobDetailView";
import {
  buildJobPostingJsonLd,
  plainTextExcerpt,
} from "@/app/lib/jobs/format";
import { getPublicJobBySlug } from "@/app/lib/jobs/queries";
import { absoluteSiteUrl } from "@/app/lib/site";
import { isValidJobSlug } from "@/app/lib/jobs/validation";

type JobDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: JobDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidJobSlug(slug)) {
    return {
      title: "Yacht Job Not Found",
      robots: { index: false, follow: true },
    };
  }

  const result = await getPublicJobBySlug(slug);
  if (result.state === "unavailable") {
    return {
      title: "Yacht Jobs",
      description: "Explore published yacht jobs on BlueDeck.",
      robots: { index: false, follow: true },
    };
  }
  if (!result.job) {
    return {
      title: "Yacht Job Not Found",
      robots: { index: false, follow: true },
    };
  }

  const canonicalPath = `/jobs/${result.job.slug}`;
  const description = plainTextExcerpt(
    result.job.summary || result.job.description,
  );
  const title = `${result.job.title} Yacht Job`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: absoluteSiteUrl(canonicalPath),
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JobDetailPage({
  params,
}: JobDetailPageProps) {
  const { slug } = await params;
  if (!isValidJobSlug(slug)) notFound();

  const result = await getPublicJobBySlug(slug);
  if (result.state === "unavailable") {
    return <JobsBoardUnavailable />;
  }
  if (!result.job) notFound();

  const canonicalUrl = absoluteSiteUrl(`/jobs/${result.job.slug}`);
  const jsonLd = buildJobPostingJsonLd(result.job, canonicalUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <JobDetailView job={result.job} />
    </>
  );
}

function JobsBoardUnavailable() {
  return (
    <section className="mx-auto flex min-h-[65vh] max-w-[1500px] items-center justify-center px-5 py-16 sm:px-8 lg:px-12">
      <div className="max-w-xl rounded-3xl border border-[#071f3c]/10 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,31,60,0.09)] sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
          <BriefcaseBusiness className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-black text-[#071f3c]">
          This role is not ready to display
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#657991]">
          The public jobs board is being prepared. Please return to the main
          board for currently available opportunities.
        </p>
        <Link
          href="/jobs"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07182d] px-5 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5 hover:bg-[#0b2949]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to yacht jobs
        </Link>
      </div>
    </section>
  );
}
