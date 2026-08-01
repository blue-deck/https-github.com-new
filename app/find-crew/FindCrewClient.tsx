"use client";

import Link from "next/link";
import {
  Clock3,
  LoaderCircle,
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
  initialNextCursor: string | null;
  initialHasMore: boolean;
};

export function FindCrewClient({
  profiles: initialProfiles,
  initialNextCursor,
  initialHasMore,
}: FindCrewClientProps) {
  const { language } = useLanguage();
  const c = copy[language];
  const [profiles, setProfiles] = useState(initialProfiles);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
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

  async function loadMoreProfiles() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError("");

    try {
      const requestedCursor = nextCursor;
      const response = await fetch(
        `/api/find-crew?cursor=${encodeURIComponent(requestedCursor)}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!isCrewPageResponse(payload) || !response.ok) {
        throw new Error(c.loadMoreError);
      }
      if (
        payload.hasMore &&
        (!payload.nextCursor || payload.nextCursor === requestedCursor)
      ) {
        throw new Error(c.loadMoreError);
      }

      setProfiles((current) => {
        const profilesById = new Map(
          current.map((profile) => [profile.crewId, profile]),
        );
        for (const profile of payload.profiles) {
          profilesById.set(profile.crewId, profile);
        }
        return Array.from(profilesById.values());
      });
      setNextCursor(payload.nextCursor);
      setHasMore(payload.hasMore);
    } catch {
      setLoadMoreError(c.loadMoreError);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
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

          {hasMore ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => void loadMoreProfiles()}
                disabled={loadingMore}
                className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-white px-6 text-sm font-black text-cyan-900 transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {loadingMore ? c.loadingMore : c.loadMore}
              </button>
            </div>
          ) : null}
          {loadMoreError ? (
            <p role="alert" className="mt-3 text-center text-sm font-semibold text-rose-700">
              {loadMoreError}
            </p>
          ) : null}
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

function isCrewPageResponse(value: unknown): value is {
  ok: true;
  profiles: DiscoverableCrewPreview[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const page = value as Record<string, unknown>;
  if (
    page.ok !== true ||
    !Array.isArray(page.profiles) ||
    typeof page.hasMore !== "boolean" ||
    !isOpaqueCursor(page.nextCursor, page.hasMore)
  ) {
    return false;
  }
  return page.profiles.every(isDiscoverableCrewPreview);
}

function isOpaqueCursor(value: unknown, hasMore: boolean) {
  if (!hasMore) return value === null;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value);
}

function isDiscoverableCrewPreview(
  value: unknown,
): value is DiscoverableCrewPreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const stringFields = [
    "crewId",
    "displayName",
    "initials",
    "profilePhotoUrl",
    "currentPosition",
    "location",
    "nationality",
    "availabilityStatus",
    "memberSince",
  ];
  const arrayFields = [
    "seekingPositions",
    "preferredLocations",
    "employmentTypes",
    "personalSkills",
  ];
  return (
    stringFields.every((field) => typeof profile[field] === "string") &&
    arrayFields.every(
      (field) =>
        Array.isArray(profile[field]) &&
        (profile[field] as unknown[]).every((item) => typeof item === "string"),
    ) &&
    typeof profile.experienceYears === "number" &&
    Number.isSafeInteger(profile.experienceYears) &&
    profile.experienceYears >= 0 &&
    typeof profile.premiumProfile === "boolean"
  );
}

const copy = {
  en: {
    eyebrow: "Public crew directory",
    title: "Meet active BlueDeck crew.",
    intro:
      "Browse Crew and Captain accounts that explicitly enabled their privacy-protected Find Crew profile.",
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
    loadMore: "Load more crew",
    loadingMore: "Loading crew…",
    loadMoreError: "More crew profiles could not be loaded. Please try again.",
  },
  tr: {
    eyebrow: "Herkese açık crew rehberi",
    title: "Aktif BlueDeck crew profillerini keşfedin.",
    intro:
      "Gizlilik korumalı Mürettebat Bul profilini açıkça etkinleştiren Crew ve Captain hesaplarını inceleyin.",
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
    loadMore: "Daha fazla crew yükle",
    loadingMore: "Crew profilleri yükleniyor…",
    loadMoreError: "Diğer crew profilleri yüklenemedi. Lütfen tekrar deneyin.",
  },
} as const;
