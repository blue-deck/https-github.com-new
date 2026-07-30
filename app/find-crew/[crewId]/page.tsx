import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "../../components/PublicSiteChrome";
import { getDiscoverableCrew } from "../../lib/findCrewData";
import { absoluteSiteUrl } from "../../lib/site";
import { PublicCrewProfileContent } from "./InviteCrewPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ crewId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { crewId } = await params;
  const profile = await getDiscoverableCrew(crewId);

  if (!profile) {
    return { title: "BlueDeck" };
  }

  return {
    title: `${profile.displayName} — ${profile.currentPosition} | BlueDeck`,
    description: `${profile.currentPosition} profile in the privacy-protected BlueDeck crew directory.`,
    alternates: {
      canonical: `/find-crew/${encodeURIComponent(profile.crewId)}`,
    },
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: `${profile.displayName} — ${profile.currentPosition}`,
      description: `${profile.currentPosition} profile in the privacy-protected BlueDeck crew directory.`,
      url: absoluteSiteUrl(`/find-crew/${encodeURIComponent(profile.crewId)}`),
      images: [absoluteSiteUrl("/og.png")],
    },
  };
}

export default async function FindCrewProfilePage({ params }: PageProps) {
  const { crewId } = await params;
  const profile = await getDiscoverableCrew(crewId);

  if (!profile) notFound();

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content">
        <PublicCrewProfileContent profile={profile} />
      </main>

      <PublicFooter />
    </div>
  );
}
