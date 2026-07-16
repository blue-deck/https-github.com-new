import type { Metadata } from "next";
import { HiringPipelineClient } from "./HiringPipelineClient";

export const metadata: Metadata = {
  title: "Private Hiring Pipeline",
  description:
    "Review yacht crew applications and manage protected hiring decisions in BlueDeck.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function HiringPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HiringPipelineClient jobId={id} />;
}
