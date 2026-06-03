import type { Metadata } from "next";
import { cache, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  BadgeCheck,
  BriefcaseBusiness,
  FileText,
  Languages,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { BlueDeckMark } from "../../components/BlueDeckLogo";
import { absoluteSiteUrl } from "../../lib/site";
import { resolveSupabaseUrl } from "../../lib/supabaseConfig";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ crewId: string }>;
};

type Row = Record<string, unknown>;

type LanguageEntry = {
  name: string;
  level: string;
};

type CrewCvData = {
  profile: Row;
  documents: Row[];
  experiences: Row[];
  references: Row[];
  portfolio: Row[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { crewId } = await params;
  const cv = await getPublicCrewCv(crewId);

  if (!cv) {
    return {
      title: "Crew CV not found | BlueDeck",
    };
  }

  const name = text(cv.profile, "full_name") || "Crew Member";
  const position = primaryPosition(cv.profile);

  return {
    title: `${name} | BlueDeck Crew CV`,
    description: `${position} CV on BlueDeck.`,
    alternates: {
      canonical: absoluteSiteUrl(`/crew/${encodeURIComponent(text(cv.profile, "public_crew_id") || crewId)}`),
    },
  };
}

export default async function PublicCrewCvPage({ params }: PageProps) {
  const { crewId } = await params;
  const cv = await getPublicCrewCv(crewId);

  if (!cv) notFound();

  const { profile, documents, experiences, references, portfolio } = cv;
  const name = text(profile, "full_name") || "Crew Member";
  const position = primaryPosition(profile);
  const age = calculateAge(text(profile, "date_of_birth"));
  const languages = languageEntries(profile.languages);
  const visibleSkills = [
    ...stringArray(profile.personal_skills),
    ...stringArray(profile.personal_characteristics),
  ].slice(0, 18);
  const cleanPortfolio = portfolio.filter((photo) => text(photo, "image_url"));
  const professionalSummary =
    text(profile, "bio") ||
    `I am a ${position.toLowerCase()} looking for a professional yacht opportunity. I am reliable, guest-focused and ready to contribute to a well-run crew.`;

  return (
    <main className="min-h-screen bg-[#edf8fc] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1120px] overflow-hidden rounded-[30px] border border-[#d0e4ee] bg-white shadow-2xl shadow-slate-950/10 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d6e8f1] bg-white px-5 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <BlueDeckMark className="h-12 w-16 rounded-2xl border-slate-200 bg-slate-950" imageClassName="p-1" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#228fc4]">BlueDeck crew CV</p>
              <p className="mt-1 text-sm text-slate-500">Public profile opened from Crew ID QR.</p>
            </div>
          </div>
          <a
            href={absoluteSiteUrl("/")}
            className="rounded-xl bg-[#30216f] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#30216f]/20"
          >
            BlueDeck
          </a>
        </div>

        <div className="grid min-h-[1120px] lg:grid-cols-[310px_1fr] print:min-h-0 print:grid-cols-[286px_1fr]">
          <aside className="bg-[#2492c8] p-6 text-white">
            <div className="flex items-center gap-3">
              <BlueDeckMark className="h-12 w-16 rounded-2xl border-white/20 bg-white/10 shadow-black/20" imageClassName="p-1" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/80">BlueDeck</p>
                <p className="text-xs font-semibold text-white/65">Verified crew CV</p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="mx-auto h-36 w-36 overflow-hidden rounded-full border-[5px] border-white bg-white shadow-xl shadow-[#166a96]/25">
                {text(profile, "profile_photo_url") ? (
                  <img src={text(profile, "profile_photo_url")} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#d7f1fb] text-[#2492c8]">
                    <UserRound className="h-14 w-14" />
                  </div>
                )}
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight">{name}</h1>
              <p className="mt-2 text-base font-black uppercase tracking-[0.14em] text-white/78">{position}</p>
              <p className="mt-3 inline-flex rounded-full border border-white/35 bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]">
                {text(profile, "public_crew_id") || crewId}
              </p>
            </div>

            <div className="mt-7 divide-y divide-white/16 border-y border-white/20">
              <InfoRow label="Age" value={age ? String(age) : "-"} />
              <InfoRow label="Nationality" value={text(profile, "nationality") || "-"} />
              <InfoRow label="Smoking" value={text(profile, "smoker") || "-"} />
              <InfoRow label="Visible tattoos" value={text(profile, "visible_tattoos") || "-"} />
              <InfoRow label="Location" value={text(profile, "location") || "-"} />
            </div>

            <div className="mt-6 grid gap-3">
              <Stat label="Experience" value={`${totalExperienceYears(experiences)}y`} />
              <Stat label="References" value={String(references.length)} />
              <Stat label="Documents" value={String(documents.length)} />
            </div>

            <div className="mt-6 rounded-3xl bg-white p-4 text-slate-950 shadow-lg shadow-[#166a96]/12">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2492c8]">Contact</p>
              <div className="mt-3 space-y-2 text-sm">
                <ContactLine icon={<Phone className="h-4 w-4" />} text={text(profile, "phone") || "-"} />
                <ContactLine icon={<Mail className="h-4 w-4" />} text={text(profile, "email") || "-"} />
                <ContactLine icon={<MapPin className="h-4 w-4" />} text={text(profile, "location") || "-"} />
              </div>
            </div>
          </aside>

          <section className="bg-white p-6 sm:p-8 print:p-7">
            <header className="border-b border-slate-200 pb-6">
              <p className="text-lg font-black uppercase tracking-[0.04em] text-[#2492c8]">Public Crew CV</p>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-700">
                BlueDeck CV prepared for captains, managers and recruiters reviewing {position.toLowerCase()} profiles.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniCard label="Looking for" value={stringArray(profile.seeking_positions)[0] || position} />
                <MiniCard label="Available for" value={stringArray(profile.work_preferences)[0] || "Yacht position"} />
                <MiniCard label="Documents" value={`${documents.length} on CV`} />
              </div>
            </header>

            <CvSection title="Professional Summary" icon={<BadgeCheck className="h-4 w-4" />}>
              <div className="rounded-2xl border border-[#d6e8f1] bg-[#f7fcff] p-5 shadow-sm shadow-[#2492c8]/5">
                <p className="text-[15px] leading-7 text-slate-800">{professionalSummary}</p>
              </div>
            </CvSection>

            <CvSection title="Yacht Experience" badge={`${totalExperienceYears(experiences)} years`} icon={<BriefcaseBusiness className="h-4 w-4" />}>
              <div className="space-y-4">
                {experiences.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    No yacht experience added yet.
                  </p>
                )}
                {experiences.map((experience) => (
                  <article key={text(experience, "id") || `${text(experience, "yacht_name")}-${text(experience, "start_date")}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5">
                    <div className="grid gap-4 sm:grid-cols-[112px_1fr]">
                      {text(experience, "photo_url") ? (
                        <img src={text(experience, "photo_url")} alt={text(experience, "yacht_name") || "Yacht"} className="h-24 w-full rounded-xl object-cover" />
                      ) : (
                        <div className="hidden h-24 rounded-xl bg-[linear-gradient(135deg,#e8f6fb,#f5f1ff)] sm:block" />
                      )}
                      <div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h2 className="text-lg font-black text-slate-950">{text(experience, "yacht_name") || "Yacht"}</h2>
                            <p className="mt-1 text-sm font-semibold text-[#2492c8]">{formatDateRange(text(experience, "start_date"), text(experience, "end_date"))}</p>
                          </div>
                          <span className="w-fit rounded-md bg-[#2492c8] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-white">
                            {text(experience, "position") || "Position"}
                          </span>
                        </div>
                        {text(experience, "description") && (
                          <p className="mt-3 text-sm leading-6 text-slate-600">{text(experience, "description")}</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </CvSection>

            <div className="mt-7 grid gap-5 xl:grid-cols-2">
              <CvSection title="Certificates & Documents" icon={<FileText className="h-4 w-4" />}>
                <div className="space-y-2">
                  {documents.length === 0 && <p className="text-sm text-slate-500">No CV documents selected.</p>}
                  {documents.slice(0, 10).map((document) => (
                    <div key={text(document, "id") || text(document, "document_type")} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">{text(document, "document_type") || "Document"}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{text(document, "category") || "Certificate"}</p>
                        </div>
                        <p className="text-right text-xs font-black text-[#2492c8]">
                          {boolean(document, "no_expiry") ? "No expiry" : formatCvDate(text(document, "expiry_date"))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CvSection>

              <CvSection title="Languages" icon={<Languages className="h-4 w-4" />}>
                <div className="space-y-3">
                  {languages.length ? (
                    languages.map((language) => (
                      <div key={language.name}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="font-black text-slate-900">{language.name}</span>
                          <span className="font-semibold text-[#2492c8]">{language.level}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#2492c8]" style={{ width: languageLevelWidth(language.level) }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No languages added yet.</p>
                  )}
                </div>
              </CvSection>
            </div>

            <div className="mt-7 grid gap-5 xl:grid-cols-2">
              <CvSection title="Skills">
                <Pills items={visibleSkills} />
              </CvSection>
              <CvSection title="Work Preferences">
                <Pills items={stringArray(profile.work_preferences)} />
              </CvSection>
            </div>

            {references.length > 0 && (
              <CvSection title="References">
                <div className="grid gap-3 sm:grid-cols-2">
                  {references.slice(0, 4).map((reference) => (
                    <div key={text(reference, "id") || text(reference, "email") || text(reference, "name")} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-black text-slate-900">{text(reference, "name") || "Reference"}</p>
                      <p className="mt-1 text-sm font-semibold text-[#2492c8]">
                        {[text(reference, "role"), text(reference, "vessel") || text(reference, "company")].filter(Boolean).join(" / ") || "Yacht reference"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{[text(reference, "email"), text(reference, "phone")].filter(Boolean).join(" / ")}</p>
                    </div>
                  ))}
                </div>
              </CvSection>
            )}

            {cleanPortfolio.length > 0 && (
              <CvSection title="Portfolio">
                <div className="grid grid-cols-3 gap-3">
                  {cleanPortfolio.slice(0, 6).map((photo) => (
                    <figure key={text(photo, "id") || text(photo, "image_url")} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={text(photo, "image_url")} alt={text(photo, "title") || "Portfolio"} className="h-28 w-full object-cover" />
                      {(text(photo, "title") || text(photo, "location")) && (
                        <figcaption className="px-3 py-2 text-xs font-semibold text-slate-600">
                          {text(photo, "title") || text(photo, "location")}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </CvSection>
            )}

            <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
              This CV is generated from BlueDeck profile data and opened through a Crew ID QR code.
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}

const getPublicCrewCv = cache(async function getPublicCrewCv(crewId: string): Promise<CrewCvData | null> {
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

  const profileId = String(profile.id);
  const [documentRes, experienceRes, referenceRes, portfolioRes] = await Promise.all([
    serviceClient
      .from("crew_documents")
      .select("*")
      .eq("crew_profile_id", profileId)
      .eq("show_on_cv", true)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("crew_experiences")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("start_date", { ascending: false }),
    serviceClient
      .from("crew_references")
      .select("*")
      .eq("crew_profile_id", profileId)
      .eq("show_on_cv", true)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("crew_portfolio_photos")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    profile: profile as Row,
    documents: (documentRes.data || []) as Row[],
    experiences: (experienceRes.data || []) as Row[],
    references: (referenceRes.data || []) as Row[],
    portfolio: (portfolioRes.data || []) as Row[],
  };
});

function primaryPosition(profile: Row) {
  return stringArray(profile.current_positions)[0] || text(profile, "current_position") || "Yacht Crew";
}

function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function boolean(row: Row, key: string) {
  return row[key] === true;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function languageEntries(value: unknown): LanguageEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const level = typeof entry.level === "string" ? entry.level.trim() : "";
      return name ? { name, level: level || "Intermediate" } : null;
    })
    .filter((item): item is LanguageEntry => Boolean(item));
}

function totalExperienceYears(experiences: Row[]) {
  const firstYear = experiences
    .map((item) => Number(text(item, "start_date").slice(0, 4)))
    .filter(Boolean)
    .sort((a, b) => a - b)[0];
  return firstYear ? `${Math.max(new Date().getFullYear() - firstYear, 1)}+` : "0";
}

function calculateAge(value?: string) {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age > 0 ? age : null;
}

function formatCvDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatDateRange(start?: string, end?: string) {
  const startText = formatCvDate(start);
  const endText = end ? formatCvDate(end) : "Present";
  if (startText === "-" && endText === "Present") return "Present";
  return `${startText} - ${endText}`;
}

function languageLevelWidth(level: string) {
  const normalized = level.toLowerCase();
  if (normalized.includes("native")) return "100%";
  if (normalized.includes("fluent")) return "88%";
  if (normalized.includes("advanced")) return "76%";
  if (normalized.includes("intermediate")) return "58%";
  if (normalized.includes("basic")) return "34%";
  return "50%";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-sm">
      <p className="font-semibold text-white/70">{label}</p>
      <p className="text-right font-black text-white">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 text-slate-950 shadow-lg shadow-[#166a96]/10">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2492c8]">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function ContactLine({ icon, text: value }: { icon: ReactNode; text: string }) {
  return (
    <p className="flex items-start gap-2 break-words font-semibold">
      <span className="mt-0.5 text-[#2492c8]">{icon}</span>
      <span>{value}</span>
    </p>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function CvSection({
  title,
  badge,
  icon,
  children,
}: {
  title: string;
  badge?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#30216f]">
          {icon}
          {title}
        </h2>
        {badge && <span className="rounded-full bg-[#2492c8] px-3 py-1 text-xs font-black text-white">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function Pills({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">No items added yet.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
          {item}
        </span>
      ))}
    </div>
  );
}
