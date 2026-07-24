"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import type { DiscoverableCrewProfile } from "../lib/findCrewData";
import { supabase } from "../lib/supabase";

type FindCrewClientProps = {
  profiles: DiscoverableCrewProfile[];
};

export function FindCrewClient({ profiles }: FindCrewClientProps) {
  const { language } = useLanguage();
  const c = copy[language];
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [availability, setAvailability] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [shortlistSaving, setShortlistSaving] = useState("");
  const [shortlistOnly, setShortlistOnly] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setShortlist(readShortlist(data.user?.user_metadata));
    });
  }, []);

  const positions = useMemo(
    () =>
      uniqueSorted(
        profiles.flatMap((profile) => [
          profile.currentPosition,
          ...profile.seekingPositions,
        ]),
      ),
    [profiles],
  );
  const locations = useMemo(
    () =>
      uniqueSorted(
        profiles.flatMap((profile) => [
          profile.location,
          ...profile.discovery.preferredLocations,
        ]),
      ),
    [profiles],
  );
  const availabilities = useMemo(
    () => uniqueSorted(profiles.map((profile) => profile.discovery.availabilityStatus)),
    [profiles],
  );
  const employmentTypes = useMemo(
    () => uniqueSorted(profiles.flatMap((profile) => profile.discovery.employmentTypes)),
    [profiles],
  );

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return profiles.filter((profile) => {
      if (shortlistOnly && !shortlist.includes(profile.crewId)) return false;
      const searchText = [
        profile.fullName,
        profile.currentPosition,
        ...profile.seekingPositions,
        profile.location,
        profile.nationality,
        profile.bio,
        ...profile.personalSkills,
      ]
        .join(" ")
        .toLocaleLowerCase();

      if (normalizedQuery && !searchText.includes(normalizedQuery)) return false;
      if (
        position &&
        ![profile.currentPosition, ...profile.seekingPositions].includes(position)
      ) {
        return false;
      }
      if (
        location &&
        ![profile.location, ...profile.discovery.preferredLocations].includes(location)
      ) {
        return false;
      }
      if (availability && profile.discovery.availabilityStatus !== availability) return false;
      if (
        employmentType &&
        !profile.discovery.employmentTypes.includes(employmentType)
      ) {
        return false;
      }
      return true;
    });
  }, [availability, employmentType, location, position, profiles, query, shortlist, shortlistOnly]);

  const hasFilters = Boolean(query || position || location || availability || employmentType || shortlistOnly);

  async function toggleShortlist(crewId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/find-crew")}`;
      return;
    }

    const nextShortlist = shortlist.includes(crewId)
      ? shortlist.filter((item) => item !== crewId)
      : [...shortlist, crewId];

    setShortlistSaving(crewId);
    const { error } = await supabase.auth.updateUser({
      data: { crew_shortlist: nextShortlist },
    });
    setShortlistSaving("");

    if (!error) setShortlist(nextShortlist);
  }

  function clearFilters() {
    setQuery("");
    setPosition("");
    setLocation("");
    setAvailability("");
    setEmploymentType("");
    setShortlistOnly(false);
  }

  return (
    <main className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <section className="relative overflow-hidden border-b border-[#071f3c]/8 bg-[linear-gradient(145deg,#f7fbfd_0%,#eaf4f7_52%,#ffffff_100%)]">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 pb-14 pt-14 sm:px-8 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:px-12 lg:pb-20 lg:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              {c.eyebrow}
            </div>
            <h1 className="bd-serif mt-6 max-w-4xl text-5xl leading-[0.98] text-[#071f3c] sm:text-7xl">
              {c.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526b83]">
              {c.intro}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white/76 p-5 shadow-2xl shadow-[#071f3c]/8 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
              {c.privacyTitle}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{c.privacyText}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="rounded-[28px] border border-[#071f3c]/10 bg-white p-4 shadow-xl shadow-[#071f3c]/5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-black text-[#071f3c]">
            <SlidersHorizontal className="h-5 w-5 text-cyan-700" />
            {c.filters}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
            <label className="relative block">
              <span className="sr-only">{c.search}</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={c.searchPlaceholder}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </label>
            <FilterSelect label={c.position} value={position} onChange={setPosition} options={positions} />
            <FilterSelect label={c.location} value={location} onChange={setLocation} options={locations} />
            <FilterSelect label={c.availability} value={availability} onChange={setAvailability} options={availabilities} />
            <FilterSelect label={c.contract} value={employmentType} onChange={setEmploymentType} options={employmentTypes} />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
              {c.results}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]">
              {filteredProfiles.length} {c.profiles}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shortlist.length > 0 ? (
              <button
                type="button"
                onClick={() => setShortlistOnly((current) => !current)}
                className={`bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                  shortlistOnly
                    ? "border-cyan-300 bg-cyan-50 text-cyan-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-800"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${shortlistOnly ? "fill-current" : ""}`} />
                {c.shortlist} ({shortlist.length})
              </button>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-cyan-300 hover:text-cyan-800"
              >
                <X className="h-4 w-4" />
                {c.clear}
              </button>
            ) : null}
          </div>
        </div>

        {filteredProfiles.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProfiles.map((profile) => (
              <article
                key={profile.crewId}
                className="group overflow-hidden rounded-[28px] border border-[#071f3c]/10 bg-white shadow-xl shadow-[#071f3c]/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#071f3c]/9"
              >
                <div className="h-1.5 bg-[linear-gradient(90deg,#083344,#22d3ee,#8ed8e6)]" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {profile.profilePhotoUrl ? (
                          <img
                            src={profile.profilePhotoUrl}
                            alt={profile.fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-cyan-700">
                            <UserRound className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 data-i18n-ignore className="truncate text-xl font-semibold text-slate-950">
                          {profile.fullName}
                        </h3>
                        <p data-i18n-ignore className="mt-1 truncate text-sm font-black text-cyan-800">
                          {profile.currentPosition}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleShortlist(profile.crewId)}
                      disabled={shortlistSaving === profile.crewId}
                      aria-label={shortlist.includes(profile.crewId) ? c.removeShortlist : c.addShortlist}
                      className={`bd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                        shortlist.includes(profile.crewId)
                          ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                          : "border-slate-200 bg-white text-slate-500 hover:border-cyan-300 hover:text-cyan-800"
                      }`}
                    >
                      <Bookmark className={`h-5 w-5 ${shortlist.includes(profile.crewId) ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <StatusPill>{profile.discovery.availabilityStatus}</StatusPill>
                    {profile.experienceYears > 0 ? (
                      <StatusPill>{profile.experienceYears}+ {c.years}</StatusPill>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-2.5 text-sm text-slate-600">
                    <InfoLine icon={<MapPin className="h-4 w-4" />} value={profile.location || c.locationFlexible} />
                    <InfoLine
                      icon={<BriefcaseBusiness className="h-4 w-4" />}
                      value={profile.seekingPositions.slice(0, 2).join(" · ") || profile.currentPosition}
                    />
                    <InfoLine
                      icon={<CalendarDays className="h-4 w-4" />}
                      value={profile.discovery.availableFrom ? `${c.from} ${formatDate(profile.discovery.availableFrom, language)}` : c.dateFlexible}
                    />
                  </div>

                  <Link
                    href={`/find-crew/${encodeURIComponent(profile.crewId)}`}
                    className="bd-focus mt-6 flex min-h-12 items-center justify-between rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
                  >
                    {c.viewProfile}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[30px] border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-14 text-center">
            <UserRound className="mx-auto h-10 w-10 text-cyan-700" />
            <h3 className="mt-5 text-2xl font-semibold text-[#071f3c]">
              {hasFilters ? c.noMatchesTitle : c.emptyTitle}
            </h3>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
              {hasFilters ? c.noMatchesText : c.emptyText}
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white"
              >
                {c.clear}
              </button>
            ) : (
              <Link
                href="/profile"
                className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white"
              >
                {c.publishProfile}
              </Link>
            )}
          </div>
        )}
      </section>

      <PublicFooter />
    </main>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoLine({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <p data-i18n-ignore className="flex items-center gap-2.5">
      <span className="text-cyan-700">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </p>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span data-i18n-ignore className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-900">
      {children}
    </span>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function readShortlist(metadata?: Record<string, unknown>) {
  const value = metadata?.crew_shortlist;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 100);
}

function formatDate(value: string, language: "en" | "tr") {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const copy = {
  en: {
    eyebrow: "Permission-based crew discovery",
    title: "Find the right crew for the next chapter.",
    intro:
      "Search professional yacht crew who have chosen to be discoverable on BlueDeck. Filter by role, location, availability and contract preference.",
    privacyTitle: "Private by default",
    privacyText:
      "Contact details never appear in search. Crew controls profile visibility, and yacht invitations remain inside the secure BlueDeck workflow.",
    filters: "Search and filters",
    search: "Search crew",
    searchPlaceholder: "Name, position or skill",
    position: "All positions",
    location: "All locations",
    availability: "Any availability",
    contract: "Any contract",
    results: "Discoverable network",
    profiles: "crew profiles",
    clear: "Clear filters",
    years: "years",
    from: "From",
    locationFlexible: "Location flexible",
    dateFlexible: "Start date flexible",
    viewProfile: "View secure profile",
    addShortlist: "Add to shortlist",
    removeShortlist: "Remove from shortlist",
    shortlist: "Shortlist",
    noMatchesTitle: "No profiles match these filters",
    noMatchesText: "Clear one or more filters to see other discoverable crew.",
    emptyTitle: "The discoverable crew network is opening",
    emptyText:
      "Crew profiles stay private until their owner explicitly publishes them. Sign in to publish your own professional profile.",
    publishProfile: "Manage profile visibility",
  },
  tr: {
    eyebrow: "İzin tabanlı mürettebat keşfi",
    title: "Bir sonraki dönem için doğru ekibi bulun.",
    intro:
      "BlueDeck’te keşfedilebilir olmayı seçen profesyonel yat mürettebatını pozisyon, konum, müsaitlik ve kontrat tercihine göre arayın.",
    privacyTitle: "Varsayılan olarak gizli",
    privacyText:
      "İletişim bilgileri aramada gösterilmez. Profil görünürlüğünü crew yönetir; yat davetleri güvenli BlueDeck akışında kalır.",
    filters: "Arama ve filtreler",
    search: "Mürettebat ara",
    searchPlaceholder: "İsim, pozisyon veya yetenek",
    position: "Tüm pozisyonlar",
    location: "Tüm konumlar",
    availability: "Tüm müsaitlik durumları",
    contract: "Tüm kontrat türleri",
    results: "Keşfedilebilir ağ",
    profiles: "mürettebat profili",
    clear: "Filtreleri temizle",
    years: "yıl",
    from: "Başlangıç",
    locationFlexible: "Konum esnek",
    dateFlexible: "Başlangıç tarihi esnek",
    viewProfile: "Güvenli profili görüntüle",
    addShortlist: "Kısa listeye ekle",
    removeShortlist: "Kısa listeden çıkar",
    shortlist: "Kısa liste",
    noMatchesTitle: "Bu filtrelere uygun profil yok",
    noMatchesText: "Diğer keşfedilebilir crew profillerini görmek için bazı filtreleri temizleyin.",
    emptyTitle: "Keşfedilebilir crew ağı açılıyor",
    emptyText:
      "Crew profilleri, sahibi açıkça yayınlayana kadar gizli kalır. Kendi profesyonel profilinizi yayınlamak için giriş yapın.",
    publishProfile: "Profil görünürlüğünü yönet",
  },
} as const;
