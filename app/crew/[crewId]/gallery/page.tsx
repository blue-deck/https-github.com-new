import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Camera, FileText, UserRound } from "lucide-react";
import { BlueDeckMark } from "../../../components/BlueDeckLogo";
import { CrewBackLink } from "../../../components/CrewBackLink";
import {
  publicStringArray,
  redactPublicContactDetails,
  safeOwnedPublicMediaUrl,
} from "../../../lib/publicCrewSafety";
import { loadEligiblePublicCrewContext } from "../../../lib/findCrewData";
import { absoluteSiteUrl } from "../../../lib/site";
import { PublicCrewGallery, type PublicGalleryPhoto } from "./GalleryClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ crewId: string }>;
};

type Row = Record<string, unknown>;

type GalleryData = {
  profile: Row;
  photos: PublicGalleryPhoto[];
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { crewId } = await params;
  const gallery = await getPublicCrewGallery(crewId);

  if (!gallery) {
    return {
      title: "Crew photo gallery not found | BlueDeck",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const name = text(gallery.profile, "full_name") || "Crew Member";
  const position = primaryPosition(gallery.profile);
  const publicCrewId = text(gallery.profile, "public_crew_id") || crewId;

  return {
    title: `${name} Photo Gallery | BlueDeck`,
    description: `${position} professional yacht work photo gallery on BlueDeck.`,
    alternates: {
      canonical: absoluteSiteUrl(`/crew/${encodeURIComponent(publicCrewId)}/gallery`),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PublicCrewGalleryPage({ params }: PageProps) {
  const { crewId } = await params;
  const gallery = await getPublicCrewGallery(crewId);

  if (!gallery) notFound();

  const name = text(gallery.profile, "full_name") || "Crew Member";
  const position = primaryPosition(gallery.profile);
  const profilePhoto = text(gallery.profile, "profile_photo_url");
  const publicCrewId = text(gallery.profile, "public_crew_id") || crewId;

  return (
    <main className="bd-page-gutter min-h-screen min-w-0 bg-[#eef5f6] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-[#06111f] sm:px-6 sm:pb-6 lg:px-8">
      <nav aria-label="Crew portal navigation" className="bd-page-frame mx-auto mb-3 flex max-w-6xl items-center justify-between gap-3">
        <CrewBackLink href={`/find-crew/${encodeURIComponent(publicCrewId)}`} />
        <Link href="/" aria-label="BlueDeck home" className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-lg px-1">
          <BlueDeckMark className="h-9 w-9" />
          <span className="text-xs font-black tracking-wide text-[#173f4a]">BlueDeck.app</span>
        </Link>
      </nav>
      <section className="bd-page-frame mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#c7d9df] bg-white shadow-xl shadow-slate-950/5 sm:rounded-[28px]">
        <header className="relative overflow-hidden bg-[#06111f] px-4 py-6 text-white sm:px-8 sm:py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(95,211,229,0.22),transparent_30%),linear-gradient(120deg,#06111f_0%,#0d2534_56%,#123748_100%)]" />
          <div className="relative flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-[#dce8ec] shadow-xl shadow-slate-950/25 sm:h-20 sm:w-20">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt={`${name} profile photo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#2d7482]">
                    <UserRound className="h-9 w-9" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9be7f1]">Crew portal</p>
                <h1 className="mt-1 break-words text-2xl font-black leading-tight sm:text-4xl" data-i18n-ignore>{name}</h1>
                <p className="mt-2 break-words text-sm font-semibold text-white/80">{position}</p>
              </div>
            </div>
            <Link
              href={`/crew/${encodeURIComponent(publicCrewId)}`}
              className="bd-focus inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#173f4a] transition hover:bg-cyan-50 sm:w-auto"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Open CV
            </Link>
          </div>
        </header>

        <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <aside className="min-w-0 border-b border-[#d8e5e9] bg-[#e8eff1] p-4 lg:border-b-0 lg:border-r lg:p-6">
              <div className="grid gap-3 rounded-xl border border-white/70 bg-white/72 p-4">
                <InfoLine label="Crew ID" value={publicCrewId.toUpperCase()} />
                <InfoLine label="Photos" value={String(gallery.photos.length)} />
                <InfoLine label="Profile" value={position} />
              </div>
          </aside>

          <section className="min-w-0 p-4 sm:p-6 lg:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173f4a] text-white shadow-lg shadow-[#173f4a]/15">
                <Camera className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-[#06111f]">Photo Gallery</h2>
                <p className="text-sm font-semibold text-[#64727a]">Tap a photo to view it larger.</p>
              </div>
            </div>
            <PublicCrewGallery photos={gallery.photos} crewName={name} />
          </section>
        </div>
      </section>
    </main>
  );
}

const getPublicCrewGallery = cache(async function getPublicCrewGallery(crewId: string): Promise<GalleryData | null> {
  const context = await loadEligiblePublicCrewContext(crewId);
  if (!context) return null;
  const { crewId: cleanCrewId, serviceClient } = context;
  const profile = context.profile as Row;

  const { data: photos, error: photosError } = await serviceClient
    .from("crew_portfolio_photos")
    .select("id,image_url,created_at,location")
    .eq("crew_profile_id", String(profile.id))
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (photosError) return null;

  return {
    profile: {
      public_crew_id: cleanCrewId,
      full_name: redactPublicContactDetails(profile.full_name, 120) || "Crew Member",
      profile_photo_url: safeOwnedPublicMediaUrl(profile.profile_photo_url, [
        profile.id,
        profile.user_id,
      ])
        ? publicCrewMediaProxyUrl(cleanCrewId, "avatar")
        : "",
      current_position: redactPublicContactDetails(
        profile.current_position,
        120,
      ),
      current_positions: publicStringArray(
        profile.current_positions,
        18,
        120,
      ),
    },
    photos: (photos || [])
      .map((photo) => {
        const photoId = text(photo as Row, "id");
        const imageUrl =
          isUuid(photoId) &&
          safeOwnedPublicMediaUrl(photo.image_url, [profile.id, profile.user_id])
            ? publicCrewMediaProxyUrl(cleanCrewId, "portfolio", photoId)
            : "";
        return {
          id: photoId,
          imageUrl,
          order: gallerySortValue(photo as Row),
        };
      })
      .sort((first, second) => first.order - second.order)
      .filter((photo) => photo.imageUrl),
  };
});

function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function primaryPosition(profile: Row) {
  return stringArray(profile.current_positions)[0] || text(profile, "current_position") || "Yacht Crew";
}

const galleryOrderPrefix = "__BLUDECK_GALLERY_ORDER__";

function gallerySortValue(photo: Row) {
  const location = text(photo, "location");
  if (location.startsWith(galleryOrderPrefix)) {
    const lineBreak = location.indexOf("\n");
    const orderText = location.slice(galleryOrderPrefix.length, lineBreak === -1 ? undefined : lineBreak).trim();
    const order = Number(orderText);
    if (Number.isFinite(order)) return order;
  }

  const createdAt = Date.parse(text(photo, "created_at"));
  return createdAt ? -createdAt : 0;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-[#d5e0e4] pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="shrink-0 font-semibold text-[#65727a]">{label}</span>
      <span className="min-w-0 break-words text-right font-black text-[#06111f]">{value}</span>
    </div>
  );
}

function publicCrewMediaProxyUrl(
  crewId: string,
  kind: "avatar" | "portfolio",
  id?: string,
) {
  const search = new URLSearchParams({ kind });
  if (id) search.set("id", id);
  return `/api/find-crew/${encodeURIComponent(crewId)}/media?${search.toString()}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
