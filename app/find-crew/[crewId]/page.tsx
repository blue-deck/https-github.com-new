import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Languages,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../../components/PublicSiteChrome";
import { getDiscoverableCrew } from "../../lib/findCrewData";
import { absoluteSiteUrl } from "../../lib/site";
import { InviteCrewPanel } from "./InviteCrewPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ crewId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { crewId } = await params;
  const profile = await getDiscoverableCrew(crewId);

  if (!profile) {
    return { title: "Crew profile not found | BlueDeck" };
  }

  return {
    title: `${profile.fullName} — ${profile.currentPosition} | BlueDeck`,
    description:
      profile.bio ||
      `${profile.currentPosition} available through the permission-based BlueDeck crew network.`,
    alternates: {
      canonical: `/find-crew/${encodeURIComponent(profile.crewId)}`,
    },
    openGraph: {
      title: `${profile.fullName} — ${profile.currentPosition}`,
      description: profile.bio || "Discoverable yacht crew profile on BlueDeck.",
      url: absoluteSiteUrl(`/find-crew/${encodeURIComponent(profile.crewId)}`),
      images: profile.profilePhotoUrl ? [profile.profilePhotoUrl] : undefined,
    },
  };
}

export default async function FindCrewProfilePage({ params }: PageProps) {
  const { crewId } = await params;
  const profile = await getDiscoverableCrew(crewId);

  if (!profile) notFound();

  return (
    <main className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <section className="border-b border-[#071f3c]/8 bg-[linear-gradient(145deg,#f4fafc,#ffffff)]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <Link
            href="/find-crew"
            className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-cyan-300 hover:text-cyan-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to crew search
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <article className="overflow-hidden rounded-[32px] border border-[#071f3c]/10 bg-white shadow-2xl shadow-[#071f3c]/7">
              <div className="h-2 bg-[linear-gradient(90deg,#083344,#22d3ee,#8ed8e6)]" />
              <div className="p-6 sm:p-9">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="h-32 w-32 shrink-0 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
                    {profile.profilePhotoUrl ? (
                      <img
                        src={profile.profilePhotoUrl}
                        alt={profile.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-cyan-700">
                        <UserRound className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                      <BadgeCheck className="h-4 w-4" />
                      Discoverable BlueDeck profile
                    </div>
                    <h1 data-i18n-ignore className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                      {profile.fullName}
                    </h1>
                    <p data-i18n-ignore className="mt-3 text-xl font-black text-cyan-800">
                      {profile.currentPosition}
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <ProfileFact icon={<MapPin />} label="Current location" value={profile.location || "Flexible"} />
                  <ProfileFact icon={<CalendarDays />} label="Availability" value={profile.discovery.availabilityStatus} />
                  <ProfileFact
                    icon={<BriefcaseBusiness />}
                    label="Yacht experience"
                    value={profile.experienceYears > 0 ? `${profile.experienceYears}+ years` : "Building profile"}
                  />
                  <ProfileFact
                    icon={<ShieldCheck />}
                    label="Contact"
                    value="Protected by request"
                  />
                </div>

                {profile.bio ? (
                  <section className="mt-9 border-t border-slate-200 pt-8">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                      Professional summary
                    </p>
                    <p data-i18n-ignore className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                      {profile.bio}
                    </p>
                  </section>
                ) : null}

                <div className="mt-9 grid gap-8 border-t border-slate-200 pt-8 md:grid-cols-2">
                  <ProfileList
                    title="Seeking positions"
                    items={profile.seekingPositions.length ? profile.seekingPositions : [profile.currentPosition]}
                  />
                  <ProfileList
                    title="Contract preferences"
                    items={[
                      ...profile.discovery.employmentTypes,
                      ...profile.workPreferences,
                    ]}
                  />
                  <ProfileList
                    title="Preferred regions"
                    items={
                      profile.discovery.preferredLocations.length
                        ? profile.discovery.preferredLocations
                        : [profile.location].filter(Boolean)
                    }
                  />
                  <ProfileList
                    title="Skills"
                    items={[...profile.personalSkills, ...profile.personalCharacteristics]}
                  />
                </div>

                {profile.languages.length > 0 ? (
                  <section className="mt-8 border-t border-slate-200 pt-8">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                      <Languages className="h-4 w-4" />
                      Languages
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.languages.map((language) => (
                        <span
                          data-i18n-ignore
                          key={`${language.name}-${language.level}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          {language.name}
                          {language.level ? ` · ${language.level}` : ""}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </article>

            <InviteCrewPanel
              crewId={profile.crewId}
              fullName={profile.fullName}
              defaultPosition={profile.seekingPositions[0] || profile.currentPosition}
            />
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function ProfileFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-cyan-700 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      </div>
      <p data-i18n-ignore className="mt-2 font-black text-slate-900">{value}</p>
    </div>
  );
}

function ProfileList({ title, items }: { title: string; items: string[] }) {
  const cleanItems = Array.from(new Set(items.filter(Boolean))).slice(0, 10);
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">{title}</p>
      {cleanItems.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {cleanItems.map((item) => (
            <span
              data-i18n-ignore
              key={item}
              className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-950"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Flexible</p>
      )}
    </section>
  );
}
