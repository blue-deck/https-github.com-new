"use client";

import Link from "next/link";
import {
  Clock3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CrewCandidatePassportCard } from "../components/CrewCandidatePresentation";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import type { DiscoverableCrewPreview } from "../lib/findCrewData";

type FindCrewClientProps = {
  profiles: DiscoverableCrewPreview[];
};

export function FindCrewClient({ profiles }: FindCrewClientProps) {
  const { language } = useLanguage();
  const c = copy[language];
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [availability, setAvailability] = useState("");
  const [employmentType, setEmploymentType] = useState("");

  const positions = useMemo(
    () =>
      uniqueSorted(
        profiles.flatMap((profile) => [
          profile.currentPosition,
          ...profile.seekingPositions,
        ]),
        language,
      ),
    [language, profiles],
  );
  const locations = useMemo(
    () =>
      uniqueSorted(
        profiles.flatMap((profile) => [
          profile.location,
          ...profile.preferredLocations,
        ]),
        language,
      ),
    [language, profiles],
  );
  const availabilities = useMemo(
    () =>
      uniqueSorted(
        profiles.map((profile) => profile.availabilityStatus),
        language,
      ),
    [language, profiles],
  );
  const employmentTypes = useMemo(
    () =>
      uniqueSorted(
        profiles.flatMap((profile) => profile.employmentTypes),
        language,
      ),
    [language, profiles],
  );

  const filteredProfiles = useMemo(() => {
    const locale = language === "tr" ? "tr-TR" : "en-US";
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);

    return profiles.filter((profile) => {
      const searchText = [
        profile.displayName,
        profile.currentPosition,
        ...profile.seekingPositions,
        profile.location,
        profile.nationality,
        ...profile.personalSkills,
      ]
        .join(" ")
        .toLocaleLowerCase(locale);

      if (normalizedQuery && !searchText.includes(normalizedQuery)) return false;
      if (
        position &&
        ![profile.currentPosition, ...profile.seekingPositions].includes(
          position,
        )
      ) {
        return false;
      }
      if (
        location &&
        ![profile.location, ...profile.preferredLocations].includes(location)
      ) {
        return false;
      }
      if (
        availability &&
        profile.availabilityStatus !== availability
      ) {
        return false;
      }
      if (
        employmentType &&
        !profile.employmentTypes.includes(employmentType)
      ) {
        return false;
      }
      return true;
    });
  }, [
    availability,
    employmentType,
    language,
    location,
    position,
    profiles,
    query,
  ]);

  const hasFilters = Boolean(
    query || position || location || availability || employmentType,
  );

  function clearFilters() {
    setQuery("");
    setPosition("");
    setLocation("");
    setAvailability("");
    setEmploymentType("");
  }

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-end lg:px-10 lg:py-16">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {c.eyebrow}
              </p>
              <h1 className="bd-serif mt-4 max-w-4xl text-4xl leading-[1.02] text-[#071f3c] sm:text-5xl lg:text-6xl">
                {c.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#526b83]">
                {c.intro}
              </p>
            </div>

            <aside className="border-l-2 border-cyan-600 pl-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                {c.privacyTitle}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {c.privacyText}
              </p>
            </aside>
          </div>
        </section>

        <section
          aria-labelledby="crew-results-heading"
          className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-12"
        >
          <section
            aria-labelledby="crew-filter-heading"
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            <h2
              id="crew-filter-heading"
              className="flex items-center gap-2 text-sm font-black text-[#071f3c]"
            >
              <SlidersHorizontal
                className="h-5 w-5 text-cyan-700"
                aria-hidden
              />
              {c.filters}
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  {c.search}
                </span>
                <span className="relative block">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={c.searchPlaceholder}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </span>
              </label>
              <FilterSelect
                label={c.position}
                value={position}
                onChange={setPosition}
                options={positions}
              />
              <FilterSelect
                label={c.location}
                value={location}
                onChange={setLocation}
                options={locations}
              />
              <FilterSelect
                label={c.availability}
                value={availability}
                onChange={setAvailability}
                options={availabilities}
              />
              <FilterSelect
                label={c.contract}
                value={employmentType}
                onChange={setEmploymentType}
                options={employmentTypes}
              />
            </div>
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div aria-live="polite">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                {c.results}
              </p>
              <h2
                id="crew-results-heading"
                className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]"
              >
                <span data-i18n-ignore>{filteredProfiles.length}</span>{" "}
                {c.profiles}
              </h2>
            </div>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
              >
                <X className="h-4 w-4" aria-hidden />
                {c.clear}
              </button>
            ) : null}
          </div>

          {filteredProfiles.length > 0 ? (
            <div className="mt-5 grid gap-3 xl:grid-cols-2 xl:gap-4">
              {filteredProfiles.map((profile) => (
                <CrewCandidatePassportCard
                  key={profile.crewId}
                  candidate={profile}
                  availabilityValue={
                    profile.availabilityStatus
                      ? candidateAvailabilityLabel(
                          profile.availabilityStatus,
                          language,
                        )
                      : c.notProvided
                  }
                  primaryBadge={
                    <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-800">
                      {c.activeProfile}
                    </span>
                  }
                  fourthFact={{
                    icon: <Clock3 />,
                    label: c.memberSince,
                    value: profile.memberSince
                      ? formatMonthYear(profile.memberSince, language)
                      : c.notProvided,
                  }}
                  copy={c}
                  profileHref={`/find-crew/${encodeURIComponent(profile.crewId)}`}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
              <UserRound
                className="mx-auto h-9 w-9 text-cyan-700"
                aria-hidden
              />
              <h3 className="mt-4 text-2xl font-semibold text-[#071f3c]">
                {hasFilters ? c.noMatchesTitle : c.emptyTitle}
              </h3>
              <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">
                {hasFilters ? c.noMatchesText : c.emptyText}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {c.clear}
                </button>
              ) : (
                <Link
                  href="/login?mode=signup&role=crew"
                  className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {c.createCrewAccount}
                </Link>
              )}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
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
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
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

function uniqueSorted(values: string[], language: "en" | "tr") {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((a, b) =>
    a.localeCompare(b, language === "tr" ? "tr-TR" : "en-US"),
  );
}

function candidateAvailabilityLabel(value: string, language: "en" | "tr") {
  const labels: Record<string, { en: string; tr: string }> = {
    Available: { en: "Available", tr: "Müsait" },
    "In 1 week": { en: "In 1 week", tr: "1 hafta içinde" },
    "In 1 month": { en: "In 1 month", tr: "1 ay içinde" },
    "Open to offers": { en: "Open to offers", tr: "Tekliflere açık" },
    "Not available": { en: "Not available", tr: "Müsait değil" },
  };

  return labels[value]?.[language] || value;
}

function formatMonthYear(value: string, language: "en" | "tr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    month: "short",
    year: "numeric",
  }).format(date);
}

const copy = {
  en: {
    eyebrow: "Public crew directory",
    title: "Meet active BlueDeck crew.",
    intro:
      "Browse active, email-confirmed Crew and Captain accounts through the same profile card experience used in BlueDeck hiring.",
    privacyTitle: "Name and contact protected",
    privacyText:
      "Profile and gallery photos may show a crew member's face, and selected professional and physical details are visible. Full names, contact details and private documents stay hidden.",
    filters: "Search and filters",
    search: "Search crew",
    searchPlaceholder: "Position, skill or location",
    position: "All positions",
    location: "All locations",
    availability: "Any availability",
    contract: "Any contract",
    results: "Active crew network",
    profiles: "crew profiles",
    clear: "Clear filters",
    activeProfile: "Active profile",
    memberSince: "Member since",
    nameLocked: "Crew member name protected",
    crewMember: "Yacht crew",
    premium: "Premium",
    nationality: "Nationality",
    notProvided: "Not provided",
    availableToStart: "Available to start",
    experience: "Experience",
    lessThanOneYear: "Less than 1 year",
    years: "years",
    noExperience: "Not added",
    viewProfile: "View profile",
    noMatchesTitle: "No profiles match these filters",
    noMatchesText: "Clear one or more filters to see other active crew.",
    emptyTitle: "No active crew profiles yet",
    emptyText:
      "Email-confirmed Crew and Captain accounts will appear here as the network grows.",
    createCrewAccount: "Create a crew account",
  },
  tr: {
    eyebrow: "Herkese açık crew rehberi",
    title: "Aktif BlueDeck crew profillerini keşfedin.",
    intro:
      "Aktif ve e-posta adresi onaylanmış Crew ile Captain hesaplarını, BlueDeck işe alım alanındakiyle aynı profil kartı deneyimi üzerinden inceleyin.",
    privacyTitle: "Ad ve iletişim bilgileri korumalı",
    privacyText:
      "Profil ve galeri fotoğraflarında crew üyesinin yüzü görünebilir; seçili profesyonel ve fiziksel bilgiler herkese açıktır. Tam adlar, iletişim bilgileri ve özel belgeler gizli kalır.",
    filters: "Arama ve filtreler",
    search: "Crew ara",
    searchPlaceholder: "Pozisyon, beceri veya konum",
    position: "Tüm pozisyonlar",
    location: "Tüm konumlar",
    availability: "Tüm müsaitlik durumları",
    contract: "Tüm çalışma türleri",
    results: "Aktif crew ağı",
    profiles: "crew profili",
    clear: "Filtreleri temizle",
    activeProfile: "Aktif profil",
    memberSince: "Üyelik",
    nameLocked: "Crew üyesinin adı korumalı",
    crewMember: "Yat mürettebatı",
    premium: "Premium",
    nationality: "Uyruk",
    notProvided: "Belirtilmedi",
    availableToStart: "İşe başlama müsaitliği",
    experience: "Deneyim",
    lessThanOneYear: "1 yıldan az",
    years: "yıl",
    noExperience: "Eklenmedi",
    viewProfile: "Profili görüntüle",
    noMatchesTitle: "Bu filtrelerle eşleşen profil yok",
    noMatchesText:
      "Diğer aktif crew profillerini görmek için bir veya daha fazla filtreyi temizleyin.",
    emptyTitle: "Henüz aktif crew profili yok",
    emptyText:
      "E-posta adresi onaylanmış Crew ve Captain hesapları ağ büyüdükçe burada görünecek.",
    createCrewAccount: "Crew hesabı oluştur",
  },
} as const;
