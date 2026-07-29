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
import { loadAccountCapabilities } from "../lib/accountCapabilities";
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
  const [shortlistError, setShortlistError] = useState("");
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [crewWorkspaceAccess, setCrewWorkspaceAccess] = useState<
    "loading" | "signed-out" | "allowed" | "denied"
  >("loading");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setShortlist(readShortlist(data.user?.user_metadata));

      if (!data.user) {
        setCrewWorkspaceAccess("signed-out");
        return;
      }

      const capabilities = await loadAccountCapabilities().catch(() => null);
      setCrewWorkspaceAccess(
        capabilities?.canUseCrewWorkspace === true ? "allowed" : "denied",
      );
    })();
  }, []);

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
          ...profile.discovery.preferredLocations,
        ]),
        language,
      ),
    [language, profiles],
  );
  const availabilities = useMemo(
    () =>
      uniqueSorted(
        profiles.map((profile) => profile.discovery.availabilityStatus),
        language,
      ),
    [language, profiles],
  );
  const employmentTypes = useMemo(
    () =>
      uniqueSorted(
        profiles.flatMap((profile) => profile.discovery.employmentTypes),
        language,
      ),
    [language, profiles],
  );

  const filteredProfiles = useMemo(() => {
    const locale = language === "tr" ? "tr-TR" : "en-US";
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);

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
        .toLocaleLowerCase(locale);

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
  }, [availability, employmentType, language, location, position, profiles, query, shortlist, shortlistOnly]);

  const hasFilters = Boolean(query || position || location || availability || employmentType || shortlistOnly);

  async function toggleShortlist(crewId: string) {
    if (shortlistSaving) return;

    setShortlistError("");
    setShortlistSaving(crewId);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = `/login?next=${encodeURIComponent("/find-crew")}`;
        return;
      }

      if (userError) throw userError;

      const currentShortlist = readShortlist(user.user_metadata);
      const nextShortlist = currentShortlist.includes(crewId)
        ? currentShortlist.filter((item) => item !== crewId)
        : [...currentShortlist, crewId];
      const { error } = await supabase.auth.updateUser({
        data: { crew_shortlist: nextShortlist },
      });

      if (error) throw error;

      setShortlist(nextShortlist);
      if (nextShortlist.length === 0) setShortlistOnly(false);
    } catch {
      setShortlistError(c.shortlistError);
    } finally {
      setShortlistSaving("");
    }
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
              <p className="mt-2 text-sm leading-6 text-slate-600">{c.privacyText}</p>
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
              <SlidersHorizontal className="h-5 w-5 text-cyan-700" aria-hidden />
              {c.filters}
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  {c.search}
                </span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={c.searchPlaceholder}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </span>
              </label>
              <FilterSelect label={c.position} value={position} onChange={setPosition} options={positions} />
              <FilterSelect label={c.location} value={location} onChange={setLocation} options={locations} />
              <FilterSelect label={c.availability} value={availability} onChange={setAvailability} options={availabilities} />
              <FilterSelect label={c.contract} value={employmentType} onChange={setEmploymentType} options={employmentTypes} />
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
                <span data-i18n-ignore>{filteredProfiles.length}</span> {c.profiles}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {shortlist.length > 0 ? (
                <button
                  type="button"
                  aria-pressed={shortlistOnly}
                  onClick={() => setShortlistOnly((current) => !current)}
                  className={`bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                    shortlistOnly
                      ? "border-cyan-500 bg-cyan-50 text-cyan-950"
                      : "border-slate-300 bg-white text-slate-700 hover:border-cyan-500 hover:text-cyan-900"
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${shortlistOnly ? "fill-current" : ""}`} aria-hidden />
                  {c.shortlist} ({shortlist.length})
                </button>
              ) : null}
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
          </div>

          {shortlistError ? (
            <p
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900"
              role="alert"
            >
              {shortlistError}
            </p>
          ) : null}

          {filteredProfiles.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProfiles.map((profile) => (
                <article
                  key={profile.crewId}
                  className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-cyan-300 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {profile.profilePhotoUrl ? (
                          <img
                            src={profile.profilePhotoUrl}
                            alt={profile.fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-cyan-700">
                            <UserRound className="h-7 w-7" aria-hidden />
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
                      disabled={Boolean(shortlistSaving)}
                      aria-busy={shortlistSaving === profile.crewId}
                      aria-pressed={shortlist.includes(profile.crewId)}
                      aria-label={shortlist.includes(profile.crewId) ? c.removeShortlist : c.addShortlist}
                      className={`bd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-wait disabled:opacity-60 ${
                        shortlist.includes(profile.crewId)
                          ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                          : "border-slate-300 bg-white text-slate-600 hover:border-cyan-500 hover:text-cyan-900"
                      }`}
                    >
                      <Bookmark
                        className={`h-5 w-5 ${shortlist.includes(profile.crewId) ? "fill-current" : ""}`}
                        aria-hidden
                      />
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

                  <div className="mt-auto pt-6">
                    <Link
                      href={`/find-crew/${encodeURIComponent(profile.crewId)}`}
                      className="bd-focus flex min-h-12 items-center justify-between rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
                    >
                      {c.viewProfile}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
              <UserRound className="mx-auto h-9 w-9 text-cyan-700" aria-hidden />
              <h3 className="mt-4 text-2xl font-semibold text-[#071f3c]">
                {hasFilters ? c.noMatchesTitle : c.emptyTitle}
              </h3>
              <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">
                {hasFilters
                  ? c.noMatchesText
                  : crewWorkspaceAccess === "denied"
                    ? c.employerEmptyText
                    : c.emptyText}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {c.clear}
                </button>
              ) : crewWorkspaceAccess === "loading" ? null : (
                <Link
                  href={
                    crewWorkspaceAccess === "allowed"
                      ? "/profile"
                      : crewWorkspaceAccess === "denied"
                        ? "/hiring"
                        : "/login?mode=signup&role=crew"
                  }
                  className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {crewWorkspaceAccess === "allowed"
                    ? c.publishProfile
                    : crewWorkspaceAccess === "denied"
                      ? c.openHiring
                      : c.createCrewAccount}
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

function uniqueSorted(values: string[], language: "en" | "tr") {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, language === "tr" ? "tr-TR" : "en-US"),
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
    shortlistError: "The shortlist could not be updated. Please try again.",
    noMatchesTitle: "No profiles match these filters",
    noMatchesText: "Clear one or more filters to see other discoverable crew.",
    emptyTitle: "The discoverable crew network is opening",
    emptyText:
      "Crew profiles stay private until their owner explicitly publishes them. Sign in to publish your own professional profile.",
    employerEmptyText:
      "New discoverable crew profiles will appear here. Continue to your hiring workspace to manage roles and candidates.",
    publishProfile: "Manage profile visibility",
    openHiring: "My Job Postings & Hiring",
    createCrewAccount: "Create a crew account",
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
    shortlistError: "Kısa liste güncellenemedi. Lütfen tekrar deneyin.",
    noMatchesTitle: "Bu filtrelere uygun profil yok",
    noMatchesText: "Diğer keşfedilebilir crew profillerini görmek için bazı filtreleri temizleyin.",
    emptyTitle: "Keşfedilebilir crew ağı açılıyor",
    emptyText:
      "Crew profilleri, sahibi açıkça yayınlayana kadar gizli kalır. Kendi profesyonel profilinizi yayınlamak için giriş yapın.",
    employerEmptyText:
      "Yeni keşfedilebilir crew profilleri burada görünecek. İlanları ve adayları yönetmek için işe alım alanınıza devam edin.",
    publishProfile: "Profil görünürlüğünü yönet",
    openHiring: "İş İlanlarım ve İşe Alım",
    createCrewAccount: "Crew hesabı oluştur",
  },
} as const;
