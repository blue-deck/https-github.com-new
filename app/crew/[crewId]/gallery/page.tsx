import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Camera, Ship, UserRound } from "lucide-react";
import { BlueDeckMark } from "../../../components/BlueDeckLogo";
import { absoluteSiteUrl } from "../../../lib/site";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { crewId } = await params;
  const gallery = await getPublicCrewGallery(crewId);

  if (!gallery) {
    return {
      title: "Crew photo gallery not found | BlueDeck",
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
    <main className="min-h-screen bg-[#eef5f6] px-4 py-6 text-[#06111f] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-[#c7d9df] bg-white shadow-2xl shadow-slate-950/10">
        <header className="relative overflow-hidden bg-[#06111f] px-6 py-7 text-white sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(95,211,229,0.22),transparent_30%),linear-gradient(120deg,#06111f_0%,#0d2534_56%,#123748_100%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-[#dce8ec] shadow-xl shadow-slate-950/25">
                {profilePhoto ? (
                  <img src={profilePhoto} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#2d7482]">
                    <UserRound className="h-9 w-9" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9be7f1]">Verified BlueDeck Gallery</p>
                <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{name}</h1>
                <p className="mt-1 text-sm font-semibold tracking-[0.22em] text-white/80">{position}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BlueDeckMark className="h-11 w-14 !rounded-none !border-0 !bg-transparent !shadow-none" imageClassName="!p-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9be7f1]">BlueDeck.app</p>
                <p className="mt-1 text-sm font-semibold text-white/75">Professional yacht work photos</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
          <aside className="border-b border-[#d8e5e9] bg-[#e8eff1] p-6 lg:border-b-0 lg:border-r">
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2d7482]">Gallery purpose</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#4b5960]">
                  A clean visual portfolio of yacht work, service moments, onboard projects and maritime experience.
                </p>
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm">
                <InfoLine label="Crew ID" value={publicCrewId.toUpperCase()} />
                <InfoLine label="Photos" value={String(gallery.photos.length)} />
                <InfoLine label="Profile" value={position} />
              </div>
              <a
                href={absoluteSiteUrl(`/crew/${encodeURIComponent(publicCrewId)}`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#173f4a] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#173f4a]/15 transition hover:bg-[#235f6f]"
              >
                <Ship className="h-4 w-4" />
                Open CV
              </a>
            </div>
          </aside>

          <section className="p-4 sm:p-6 lg:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173f4a] text-white shadow-lg shadow-[#173f4a]/15">
                <Camera className="h-5 w-5" />
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
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  const cleanCrewId = decodeURIComponent(crewId).trim().toUpperCase();
  if (!cleanCrewId) return null;

  const serviceClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: profile, error } = await serviceClient
    .from("crew_profiles")
    .select("*")
    .eq("public_crew_id", cleanCrewId)
    .maybeSingle();

  if (error || !profile?.id) return null;

  const { data: photos } = await serviceClient
    .from("crew_portfolio_photos")
    .select("id,image_url,created_at,location")
    .eq("crew_profile_id", String(profile.id))
    .not("image_url", "is", null)
    .order("created_at", { ascending: false });

  return {
    profile: profile as Row,
    photos: (photos || [])
      .map((photo) => ({
        id: text(photo as Row, "id") || text(photo as Row, "image_url"),
        imageUrl: text(photo as Row, "image_url"),
        order: gallerySortValue(photo as Row),
      }))
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
    <div className="flex items-center justify-between gap-4 border-b border-[#d5e0e4] pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="font-semibold text-[#65727a]">{label}</span>
      <span className="text-right font-black text-[#06111f]">{value}</span>
    </div>
  );
}
