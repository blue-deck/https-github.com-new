import type { Metadata } from "next";
import { cache, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  BriefcaseBusiness,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { BlueDeckMark } from "../../components/BlueDeckLogo";
import { CvScaleFrame } from "../../components/CvScaleFrame";
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

  const { profile, documents, experiences, references } = cv;
  const name = text(profile, "full_name") || "Crew Member";
  const position = primaryPosition(profile);
  const languages = languageEntries(profile.languages);
  const visibleSkills = [
    ...stringArray(profile.personal_skills),
    ...stringArray(profile.personal_characteristics),
  ].slice(0, 18);
  const cleanReferences = publicReferenceEntries(references);
  const standaloneReferences = publicUnmatchedExperienceReferences(experiences, cleanReferences);
  const professionalSummary =
    text(profile, "bio") ||
    `I am a ${position.toLowerCase()} looking for a professional yacht opportunity. I am reliable, guest-focused and ready to contribute to a well-run crew.`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef3f4] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <CvScaleFrame>
      <section id="bluedeck-cv" className="bd-cv-root bd-cv-public-sheet mx-auto w-[980px] max-w-none overflow-hidden rounded-[24px] border border-[#b9c8cd] bg-white shadow-2xl shadow-slate-950/14 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b9c8cd] bg-white px-5 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <BlueDeckMark className="h-12 w-16 rounded-2xl border-slate-200 bg-slate-950" imageClassName="p-1" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#228fc4]">BlueDeck crew CV</p>
              <p className="mt-1 text-sm text-slate-500">Public profile opened from Crew ID QR.</p>
            </div>
          </div>
          <a
            href={absoluteSiteUrl("/")}
            className="rounded-xl bg-[#06111f] px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20"
          >
            BlueDeck
          </a>
        </div>

        <div className="bd-cv-layout grid min-h-[1120px] grid-cols-[320px_1fr] bg-white print:min-h-0 print:grid-cols-[300px_1fr]">
          <aside className="bd-cv-sidebar relative bg-[#e7ecee] px-7 pb-8 pt-56 text-[#242a31] print:pt-56">
            <CvSidebarSignature />
            <div className="bd-cv-avatar absolute right-[-42px] top-8 z-20 h-44 w-44 translate-x-0 overflow-hidden rounded-full border-[10px] border-white bg-white shadow-xl shadow-slate-950/12">
              {text(profile, "profile_photo_url") ? (
                <img src={text(profile, "profile_photo_url")} alt={name} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#edf3f5] text-[#2d7482]">
                  <UserRound className="h-16 w-16" />
                </div>
              )}
            </div>

            <div className="bd-cv-side-stack space-y-8">
              <SideSection title="Profile">
                <div className="space-y-2.5">
                  <SidebarLine label="Date of Birth" value={formatFullCvDate(text(profile, "date_of_birth"))} />
                  <SidebarLine label="Nationality" value={text(profile, "nationality") || "-"} />
                  <SidebarLine label="Gender" value={text(profile, "gender") || "-"} />
                  <SidebarLine label="Height" value={text(profile, "height_cm") ? `${text(profile, "height_cm")} cm` : "-"} />
                  <SidebarLine label="Weight" value={text(profile, "weight_kg") ? `${text(profile, "weight_kg")} kg` : "-"} />
                  <SidebarLine label="Smoker" value={text(profile, "smoker") || "-"} />
                  <SidebarLine label="Visible tattoos" value={text(profile, "visible_tattoos") || "-"} />
                </div>
              </SideSection>

              <SideSection title="Contact">
                <div className="space-y-2.5 text-sm font-semibold text-[#3d454c]">
                  <ContactLine icon={<Phone className="h-4 w-4" />} text={text(profile, "phone") || "-"} />
                  <ContactLine icon={<Mail className="h-4 w-4" />} text={text(profile, "email") || "-"} />
                  <ContactLine icon={<MapPin className="h-4 w-4" />} text={text(profile, "location") || "-"} />
                </div>
              </SideSection>

              <SideSection title="Language">
                <div className="space-y-3">
                  {languages.length ? (
                    languages.map((language) => (
                      <div key={language.name}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="font-black text-[#242a31]">{language.name}</span>
                          <span className="font-semibold text-[#2d7482]">{language.level}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#cfd9de]">
                          <div className="h-full rounded-full bg-[#173f4a]" style={{ width: languageLevelWidth(language.level) }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#6b747a]">No languages added yet.</p>
                  )}
                </div>
              </SideSection>

              <SideSection title="Skills & Characteristics">
                <Pills items={visibleSkills} />
              </SideSection>

              <SideSection title="Preferences">
                <Pills items={stringArray(profile.work_preferences)} />
              </SideSection>

              <SideSection title="Documents & Certificates" className="bd-cv-documents-section">
                <div className="space-y-2">
                  {documents.length === 0 && <p className="text-sm text-[#6b747a]">No CV documents selected.</p>}
                  {documents.slice(0, 10).map((document) => (
                    <div key={text(document, "id") || text(document, "document_type")} className="bd-cv-document-row rounded-lg border border-[#c7d2d6] bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-black leading-4 text-[#06111f]">{text(document, "document_type") || "Document"}</p>
                          <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#7a858b]">{text(document, "category") || "Certificate"}</p>
                          {text(document, "issuer") && <p className="mt-1 truncate text-[10px] font-semibold text-[#5a6870]">{text(document, "issuer")}</p>}
                        </div>
                        <p className="shrink-0 text-right text-[10px] font-black text-[#2d7482]">
                          {boolean(document, "no_expiry") ? "No expiry" : formatCvDate(text(document, "expiry_date"))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SideSection>
            </div>
          </aside>

          <section className="bg-white">
            <header className="bd-cv-header relative bg-transparent pb-3 pt-8 text-white print:py-9">
              <div className="bd-cv-name-band mr-10 -ml-10 flex min-h-[150px] items-center rounded-r-full bg-[#20242a] px-8 pl-28 shadow-lg shadow-slate-950/10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8ed8e6]">Verified Crew Profile</p>
                  <h1 className="bd-cv-crew-name mt-3 block max-w-full whitespace-nowrap font-black uppercase leading-none text-white" style={crewNameStyle(name)}>{name}</h1>
                  <p className="mt-3 text-lg font-semibold tracking-[0.26em] text-white/82">{position}</p>
                </div>
              </div>
            </header>

            <div className="bd-cv-main p-6 sm:p-8 print:p-7">
              <CvSection title="About Me" className="mt-0">
                <p className="rounded-2xl border border-[#d8e2e6] bg-[#f6f8f8] p-4 text-[14px] leading-7 text-[#3d454c]">
                  {professionalSummary}
                </p>
              </CvSection>

              <CvSection title="Yacht Experience" badge={`${totalExperienceYears(experiences)} years`} icon={<BriefcaseBusiness className="h-4 w-4" />}>
              <div className="bd-cv-experience-list space-y-4">
                {experiences.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#c7d2d6] bg-[#f6f8f8] p-5 text-sm text-[#5a6870]">
                    No yacht experience added yet.
                  </p>
                )}
                {experiences.map((experience, index) => {
                  const experienceReferences = publicReferencesForExperience(experience, cleanReferences);
                  const yachtName = text(experience, "yacht_name") || "Yacht";

                  return (
                    <article key={text(experience, "id") || `${text(experience, "yacht_name")}-${text(experience, "start_date")}`} className={`bd-cv-experience rounded-2xl border border-[#d8e2e6] bg-white p-3 shadow-sm shadow-slate-950/5 ${shouldBreakBeforeExperience(index) ? "bd-cv-experience-break-before" : ""}`}>
                      <div className="bd-cv-experience-grid grid items-stretch gap-3 sm:grid-cols-[136px_1fr]">
                        <div className="bd-cv-experience-meta h-full rounded-xl border border-[#d8e2e6] bg-[#f6f8f8] p-2">
                          {text(experience, "photo_url") ? (
                            <img src={text(experience, "photo_url")} alt={yachtName} className="h-24 w-full rounded-lg object-cover" />
                          ) : (
                            <div className="h-24 rounded-lg bg-[linear-gradient(135deg,#f5f8f9,#e8f0f2)]" />
                          )}
                          <div className="mt-3">
                            {[experienceText(experience, "yacht_type"), experienceText(experience, "yacht_program"), experienceText(experience, "yacht_size")].filter(Boolean).length > 0 && (
                              <p className="mt-1 text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-[#6b747a]">
                                {[experienceText(experience, "yacht_type"), experienceText(experience, "yacht_program"), experienceText(experience, "yacht_size")].filter(Boolean).join(" / ")}
                              </p>
                            )}
                            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#2d7482]">{formatDateRange(text(experience, "start_date"), text(experience, "end_date"))}</p>
                            {experienceText(experience, "location") && (
                              <p className="mt-1 flex items-start gap-1.5 text-[10px] font-black uppercase leading-4 tracking-[0.06em] text-[#2d7482]">
                                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>{experienceText(experience, "location")}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="bd-cv-experience-body h-full rounded-xl border border-[#dbe4e7] bg-[#f6f8f8] p-3">
                          <div className="bd-cv-experience-titlebar mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#d8e2e6] bg-white px-3 py-2">
                            <h2 className="min-w-0 truncate font-black uppercase leading-[1.05] text-[#06111f]" style={{ fontSize: yachtNameFontSize(yachtName) }}>{yachtName}</h2>
                            <span className="inline-flex shrink-0 rounded-md bg-[#173f4a] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                              {text(experience, "position") || "Position"}
                            </span>
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b7b84]">Duties</p>
                          <p className="mt-2 text-[13px] leading-5 text-[#364650]">
                            {experienceText(experience, "description") || "Responsibilities and onboard duties will appear here."}
                          </p>
                          <PublicExperienceReferences references={experienceReferences} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </CvSection>

            {standaloneReferences.length > 0 && (
              <CvSection title="References">
                <div className="grid gap-3 sm:grid-cols-2">
                  {standaloneReferences.slice(0, 4).map((reference) => (
                    <div key={text(reference, "id") || text(reference, "email") || text(reference, "name")} className="rounded-xl border border-[#c7d2d6] bg-[#f6f8f8] p-4">
                      <p className="font-black text-[#06111f]">{publicReferenceDisplayName(reference)}</p>
                      <p className="mt-1 text-sm font-semibold text-[#2d7482]">
                        {[text(reference, "role"), text(reference, "vessel") || text(reference, "company")].filter(Boolean).join(" / ") || "Yacht reference"}
                      </p>
                      <p className="mt-2 text-xs text-[#5a6870]">{[text(reference, "email"), text(reference, "phone")].filter(Boolean).join(" / ")}</p>
                    </div>
                  ))}
                </div>
              </CvSection>
            )}

            <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
              This CV is generated from BlueDeck profile data and opened through a Crew ID QR code.
            </footer>
            </div>
          </section>
        </div>
      </section>
      </CvScaleFrame>
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
  const [documentRes, experienceRes, referenceRes] = await Promise.all([
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
  ]);

  return {
    profile: profile as Row,
    documents: (documentRes.data || []) as Row[],
    experiences: (experienceRes.data || []) as Row[],
    references: (referenceRes.data || []) as Row[],
  };
});

function primaryPosition(profile: Row) {
  return stringArray(profile.current_positions)[0] || text(profile, "current_position") || "Yacht Crew";
}

function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

const experienceMetadataPrefix = "__BLUDECK_EXPERIENCE_META__";

function experienceText(row: Row, key: string) {
  if (key === "description") return splitExperienceDescription(text(row, "description")).description.trim();
  if (key === "yacht_type" || key === "yacht_program" || key === "yacht_size" || key === "location") {
    return text(row, key) || splitExperienceDescription(text(row, "description")).meta[key] || "";
  }

  return text(row, key);
}

function splitExperienceDescription(value: string): { description: string; meta: Record<string, string> } {
  if (!value.startsWith(experienceMetadataPrefix)) return { description: value, meta: {} };
  const lineBreak = value.indexOf("\n");
  const metaText = value.slice(experienceMetadataPrefix.length, lineBreak === -1 ? undefined : lineBreak).trim();
  const description = lineBreak === -1 ? "" : value.slice(lineBreak + 1);

  try {
    const meta = JSON.parse(metaText) as Record<string, unknown>;
    return {
      description,
      meta: {
        yacht_type: typeof meta.yacht_type === "string" ? meta.yacht_type.trim() : "",
        yacht_program: typeof meta.yacht_program === "string" ? meta.yacht_program.trim() : "",
        yacht_size: typeof meta.yacht_size === "string" ? meta.yacht_size.trim() : "",
        location: typeof meta.location === "string" ? meta.location.trim() : "",
      },
    };
  } catch {
    return { description, meta: {} };
  }
}

function shouldBreakBeforeExperience(index: number) {
  return index >= 2 && (index - 2) % 3 === 0;
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

function formatCvDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatFullCvDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function yachtNameFontSize(value: string) {
  const length = value.trim().length;
  if (length <= 12) return "15px";
  if (length <= 18) return "14px";
  if (length <= 26) return "12.5px";
  if (length <= 34) return "11.5px";
  return "10.5px";
}

function crewNameStyle(value: string) {
  const length = value.trim().replace(/\s+/g, " ").length;
  if (length <= 16) return { fontSize: "38px", letterSpacing: "0.055em" };
  if (length <= 24) return { fontSize: "34px", letterSpacing: "0.04em" };
  if (length <= 34) return { fontSize: "29px", letterSpacing: "0.025em" };
  if (length <= 46) return { fontSize: "24px", letterSpacing: "0.01em" };
  if (length <= 60) return { fontSize: "20px", letterSpacing: "0" };
  return { fontSize: "17px", letterSpacing: "0" };
}

function formatDateRange(start?: string, end?: string) {
  const startText = formatCvDate(start);
  const endText = end ? formatCvDate(end) : "Present";
  if (startText === "-" && endText === "Present") return "Present";
  return `${startText} - ${endText}`;
}

function normalizeVesselName(value?: string) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(m y|s y|my|sy|motor yacht|sailing yacht|yacht)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function publicReferenceEntries(references: Row[]) {
  return references.filter((reference) =>
    Boolean(
      text(reference, "name") ||
        text(reference, "role") ||
        text(reference, "vessel") ||
        text(reference, "company") ||
        text(reference, "phone") ||
        text(reference, "email"),
    ),
  );
}

function publicReferenceMatchesExperience(reference: Row, experience: Row) {
  const vessel = normalizeVesselName(text(reference, "vessel"));
  const yacht = normalizeVesselName(text(experience, "yacht_name"));
  if (!vessel || !yacht) return false;
  if (vessel === yacht) return true;
  return vessel.length >= 3 && yacht.length >= 3 && (vessel.includes(yacht) || yacht.includes(vessel));
}

function publicReferencesForExperience(experience: Row, references: Row[]) {
  return references.filter((reference) => publicReferenceMatchesExperience(reference, experience));
}

function publicUnmatchedExperienceReferences(experiences: Row[], references: Row[]) {
  return references.filter((reference) => !experiences.some((experience) => publicReferenceMatchesExperience(reference, experience)));
}

function publicReferenceDisplayName(reference: Row) {
  const name = text(reference, "name");
  if (name && name.toLowerCase() !== "reference") return name;
  return text(reference, "company") || text(reference, "vessel") || "Contact";
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

function ContactLine({ icon, text: value }: { icon: ReactNode; text: string }) {
  return (
    <p className="flex items-start gap-2 break-words font-semibold">
      <span className="mt-0.5 text-[#2d7482]">{icon}</span>
      <span>{value}</span>
    </p>
  );
}

function CvSection({
  title,
  badge,
  icon,
  children,
  className = "mt-6",
}: {
  title: string;
  badge?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bd-cv-section ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-[#b9c8cd] pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.14em] text-[#06111f]">
          {icon}
          {title}
        </h2>
        {badge && <span className="rounded-full bg-[#173f4a] px-3 py-1 text-[11px] font-black text-white shadow-sm shadow-[#173f4a]/20">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function SideSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bd-cv-side-section ${className}`}>
      <div className="mb-3 flex items-center gap-4">
        <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#242a31]">{title}</h2>
        <div className="h-px flex-1 bg-[#242a31]/45" />
      </div>
      {children}
    </section>
  );
}

function CvSidebarSignature() {
  return (
    <div className="bd-cv-sidebar-signature absolute left-7 top-6 z-10 flex max-w-[176px] items-center gap-3">
      <BlueDeckMark className="h-10 w-14 !rounded-none !border-0 !bg-transparent !shadow-none" imageClassName="!p-0" />
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase leading-3 tracking-[0.22em] text-[#2d7482]">BlueDeck.app</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase leading-3 tracking-[0.16em] text-[#59666d]">Yachtos</p>
      </div>
    </div>
  );
}

function SidebarLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#cbd7dc] pb-2 text-[13px] last:border-b-0 last:pb-0">
      <p className="font-semibold text-[#6b747a]">{label}</p>
      <p className="break-words text-right font-black text-[#242a31]">{value}</p>
    </div>
  );
}

function PublicExperienceReferences({ references }: { references: Row[] }) {
  if (references.length === 0) return null;

  return (
    <div className="bd-cv-reference-list mt-3 border-t border-[#c7d2d6] pt-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2d7482]">Reference</p>
      <div className="mt-2 grid gap-2">
        {references.slice(0, 2).map((reference) => (
          <div key={text(reference, "id") || text(reference, "email") || text(reference, "phone") || text(reference, "name")} className="bd-cv-reference-card rounded-lg border border-[#d8e2e6] bg-white px-3 py-2">
            <p className="text-[13px] font-black text-[#06111f]">{publicReferenceDisplayName(reference)}</p>
            <p className="mt-1 text-xs font-semibold text-[#2d7482]">
              {[text(reference, "role"), text(reference, "vessel") || text(reference, "company")].filter(Boolean).join(" / ") || "Yacht reference"}
            </p>
            {(text(reference, "email") || text(reference, "phone")) && (
              <p className="mt-1 text-xs text-[#5a6870]">{[text(reference, "email"), text(reference, "phone")].filter(Boolean).join(" / ")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pills({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">No items added yet.</p>;

  return (
    <div className="bd-cv-pill-list flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
          {item}
        </span>
      ))}
    </div>
  );
}
