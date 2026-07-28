import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "../../components/PublicSiteChrome";
import { getDiscoverableCrew } from "../../lib/findCrewData";
import { absoluteSiteUrl } from "../../lib/site";
import { CrewProfileContent } from "./InviteCrewPanel";

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
    title: `${profile.fullName} — ${profile.currentPosition} | BlueDeck`,
    description: profile.bio || `${profile.currentPosition} · BlueDeck`,
    alternates: {
      canonical: `/find-crew/${encodeURIComponent(profile.crewId)}`,
    },
    openGraph: {
      title: `${profile.fullName} — ${profile.currentPosition}`,
      description: profile.bio || `${profile.currentPosition} · BlueDeck`,
      url: absoluteSiteUrl(`/find-crew/${encodeURIComponent(profile.crewId)}`),
      images: [
        profile.profilePhotoUrl ||
          absoluteSiteUrl("/og.png"),
      ],
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
        <CrewProfileContent profile={profile} />
      </main>

      <PublicFooter />
    </div>
  );
}
