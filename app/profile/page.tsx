"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Camera,
  Check,
  Download,
  ExternalLink,
  IdCard,
  Languages,
  MapPin,
  Plus,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toDataURL } from "qrcode";
import { BlueDeckMark } from "../components/BlueDeckLogo";
import { PhoneInput } from "../components/PhoneInput";
import { blueDeckCountries, nationalityOptions } from "../lib/countries";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { absoluteSiteUrl } from "../lib/site";
import { createSafeStoragePath } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { yachtPositionTitles } from "../lib/yachtOperations";

type CountryOption = (typeof blueDeckCountries)[number] | (typeof nationalityOptions)[number];
type PhoneCountryOption = (typeof blueDeckCountries)[number];

type CrewProfile = {
  id?: string;
  user_id?: string;
  public_crew_id?: string;
  email?: string;
  full_name?: string;
  profile_photo_url?: string;
  phone?: string;
  nationality?: string;
  current_position?: string;
  location?: string;
  bio?: string;
  date_of_birth?: string;
  height_cm?: number;
  weight_kg?: number;
  visible_tattoos?: string;
  smoker?: string;
  current_positions?: string[];
  seeking_positions?: string[];
  work_preferences?: string[];
  personal_skills?: string[];
  personal_characteristics?: string[];
  languages?: LanguageEntry[];
};

type LanguageEntry = {
  name: string;
  level: string;
};

type CrewDocument = {
  id?: string;
  document_type: string;
  category: string;
  issuer: string;
  issue_date: string;
  expiry_date: string;
  no_expiry: boolean;
  show_on_cv: boolean;
  file_url: string;
  notes: string;
};

type Experience = {
  id?: string;
  created_at?: string;
  yacht_name: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
  photo_url: string;
};

type PortfolioPhoto = {
  id?: string;
  title: string;
  image_url: string;
  location: string;
};

type ReferenceEntry = {
  id?: string;
  name: string;
  role: string;
  vessel: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  show_on_cv: boolean;
};

type RelatedKind = "document" | "experience" | "reference" | "portfolio";
type UploadBucket = "crew-documents" | "crew-portfolio";

const workPreferences = [
  "Seasonal",
  "Permanent",
  "Rotational",
  "Temporary",
  "Delivery",
  "Private yacht",
  "Charter yacht",
  "Motor yacht",
  "Sailing yacht",
  "Catamaran",
  "Mediterranean",
  "Caribbean",
  "Worldwide",
  "8m-20m",
  "20m-40m",
  "40m-60m",
  "60m+",
];

const personalSkills = [
  "Navigation",
  "Cruise planning",
  "COLREG",
  "Crew management",
  "Guest service",
  "Tender driving",
  "Water sports",
  "Deck maintenance",
  "Line handling",
  "Mooring operations",
  "Watchkeeping",
  "Safety management",
  "Refit and repair",
  "Engine room checks",
  "Administration",
  "Budgeting",
  "Interior service",
  "Table service",
  "Laundry",
  "Galley support",
];

const characteristics = [
  "Calm under pressure",
  "Reliable",
  "Safety-focused",
  "Discreet",
  "Guest-oriented",
  "Team player",
  "Leadership",
  "Adaptable",
  "Organized",
  "Hard-working",
  "Positive attitude",
  "Detail-oriented",
  "Stress-resistant",
  "Communicative",
  "Motivated",
];

const languageOptions = [
  "English",
  "Turkish",
  "French",
  "Italian",
  "Spanish",
  "German",
  "Greek",
  "Russian",
  "Arabic",
  "Dutch",
  "Portuguese",
  "Croatian",
  "Serbian",
  "Montenegrin",
  "Albanian",
  "Romanian",
  "Bulgarian",
  "Ukrainian",
  "Polish",
  "Danish",
  "Swedish",
  "Norwegian",
  "Finnish",
  "Hebrew",
  "Mandarin Chinese",
  "Japanese",
];

const languageLevels = ["Basic", "Intermediate", "Advanced", "Fluent", "Native"];

const documentCatalog = [
  {
    category: "Identity & Travel",
    items: ["Passport", "Seaman's Book", "Schengen Visa", "US B1/B2 Visa", "UK Visa", "Residence Permit", "National ID"],
  },
  {
    category: "STCW & Safety",
    items: [
      "STCW Basic Safety Training",
      "STCW Security Awareness",
      "Designated Security Duties",
      "Proficiency in Survival Craft",
      "Advanced Fire Fighting",
      "Medical First Aid",
      "Medical Care On Board",
      "PDSD",
      "Crowd Management",
      "Crisis Management",
    ],
  },
  {
    category: "Deck & Captain",
    items: [
      "Certificate of Competency",
      "Yacht Master",
      "Master 200GT",
      "Master 500GT",
      "OOW",
      "GMDSS GOC",
      "GMDSS ROC",
      "Radar / ARPA",
      "ECDIS",
      "RYA Powerboat Level 2",
      "Tender Operator",
      "PWC / Jetski Instructor",
    ],
  },
  {
    category: "Engineering",
    items: ["AEC 1", "AEC 2", "MEOL", "Y4 Engineer", "Y3 Engineer", "High Voltage", "Refrigeration", "Engine Manufacturer Training"],
  },
  {
    category: "Interior & Galley",
    items: ["Food Hygiene Level 2", "Food Hygiene Level 3", "Wine Service", "Silver Service", "Barista", "Mixology", "Housekeeping", "Floristry"],
  },
  {
    category: "Medical & Other",
    items: ["ENG1 Medical", "ML5 Medical", "COVID Vaccination", "Yellow Fever", "Diving Certificate", "Driving License"],
  },
];

const emptyExperience: Experience = {
  yacht_name: "",
  position: "",
  start_date: "",
  end_date: "",
  description: "",
  photo_url: "",
};

const emptyReference: ReferenceEntry = {
  name: "",
  role: "",
  vessel: "",
  company: "",
  phone: "",
  email: "",
  notes: "",
  show_on_cv: true,
};

const emptyPhoto: PortfolioPhoto = {
  title: "",
  image_url: "",
  location: "",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<CrewProfile>({});
  const [documents, setDocuments] = useState<CrewDocument[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [references, setReferences] = useState<ReferenceEntry[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);
  const [documentDraft, setDocumentDraft] = useState<CrewDocument>(newDocumentDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [referenceSaving, setReferenceSaving] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState("");
  const [uploadError, setUploadError] = useState("");
  const uploadRunRef = useRef(0);

  const cvDocuments = documents.filter((item) => item.show_on_cv);
  const cvReferences = references.filter((item) => item.show_on_cv);
  const expiryAlerts = documents.filter((item) => !item.no_expiry && isWithin90Days(item.expiry_date));
  const editableExperiences = useMemo(
    () =>
      [...experiences].sort((first, second) => {
        const firstCreatedAt = first.created_at ? Date.parse(first.created_at) : 0;
        const secondCreatedAt = second.created_at ? Date.parse(second.created_at) : 0;
        return secondCreatedAt - firstCreatedAt;
      }),
    [experiences],
  );

  const totalExperienceYears = useMemo(() => {
    const firstYear = experiences
      .map((item) => Number((item.start_date || "").slice(0, 4)))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    return firstYear ? `${Math.max(new Date().getFullYear() - firstYear, 1)}+` : "0";
  }, [experiences]);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      window.location.href = "/login";
      return;
    }

    const { data: existingProfile } = await supabase
      .from("crew_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProfile) {
      setProfile(normalizeProfile(existingProfile));
      await loadRelated(existingProfile.id);
      setLoading(false);
      return;
    }

    const newProfile = {
      user_id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
      public_crew_id: user.id.slice(0, 8).toUpperCase(),
      current_positions: [],
      seeking_positions: [],
      work_preferences: [],
      personal_skills: [],
      personal_characteristics: [],
      languages: [],
    };

    const { data } = await supabase
      .from("crew_profiles")
      .insert(newProfile)
      .select()
      .single();

    setProfile(normalizeProfile(data || newProfile));
    setLoading(false);
  }

  async function loadRelated(profileId?: string) {
    if (!profileId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch(`/api/crew-profile/related?profileId=${encodeURIComponent(profileId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      documents?: CrewDocument[];
      experiences?: Experience[];
      references?: ReferenceEntry[];
      portfolio?: PortfolioPhoto[];
    } | null;

    if (!response.ok || !result?.ok) {
      alert(result?.error || "Crew profile records could not be loaded.");
      return;
    }

    setDocuments(result.documents || []);
    setExperiences(result.experiences || []);
    setReferences(result.references || []);
    setPortfolio(result.portfolio || []);
  }

  async function saveProfile() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setSaving(false);
      window.location.href = "/login";
      return;
    }

    const profilePayload: Record<string, unknown> = {
      ...profile,
      email: profile.email || user.email,
      public_crew_id: profile.public_crew_id || user.id.slice(0, 8).toUpperCase(),
    };
    delete profilePayload.id;

    const { data, error } = await saveCrewProfileByUserId<CrewProfile>(
      supabase,
      user.id,
      profilePayload
    );

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    await Promise.all([
      saveBaseProfileById(supabase, {
        id: user.id,
        email: profile.email || user.email,
        full_name: profile.full_name || user.email,
        phone: profile.phone || "",
        role: profile.current_positions?.includes("Captain") || profile.current_position === "Captain" ? "captain" : undefined,
      }),
      supabase.auth.updateUser({
        data: {
          full_name: profile.full_name || user.email,
          phone: profile.phone || "",
        },
      }),
    ]);

    setProfile(normalizeProfile(data || { ...profile, user_id: user.id }));
    setSaving(false);
    alert("Profile saved.");
  }

  async function saveDocument() {
    if (!profile.id || !documentDraft.document_type) {
      alert("Select a document type.");
      return;
    }

    const response = await saveRelatedRecord("document", {
      ...documentDraft,
      expiry_date: documentDraft.no_expiry ? null : documentDraft.expiry_date || null,
    });

    if (!response.ok) {
      alert(response.error);
      return;
    }

    setDocumentDraft(newDocumentDraft());
    await loadRelated(profile.id);
  }

  async function updateDocument(document: CrewDocument) {
    if (!profile.id || !document.id) return;
    const response = await saveRelatedRecord("document", document, document.id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function deleteDocument(id?: string) {
    if (!profile.id || !id) return;
    const response = await deleteRelatedRecord("document", id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function saveExperience(item: Experience) {
    if (!profile.id) return;
    const response = await saveRelatedRecord("experience", item, item.id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function deleteExperience(id?: string) {
    if (!profile.id || !id) return;
    const response = await deleteRelatedRecord("experience", id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function saveReference(item: ReferenceEntry) {
    setReferenceStatus(null);

    if (!profile.id) {
      setReferenceStatus({ type: "error", message: "Crew profile is still loading. Please try again in a moment." });
      return false;
    }

    const hasReferenceDetail = [item.name, item.role, item.company, item.phone, item.email].some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    if (!hasReferenceDetail) {
      setReferenceStatus({ type: "error", message: "Add a reference name/company, role, phone or email before saving." });
      return false;
    }

    setReferenceSaving(true);
    const response = await saveRelatedRecord("reference", item, item.id).catch((error: unknown) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Reference could not be saved.",
    }));
    setReferenceSaving(false);

    if (!response.ok) {
      setReferenceStatus({ type: "error", message: response.error });
      return false;
    }

    await loadRelated(profile.id);
    setReferenceStatus({
      type: "success",
      message: "Reference saved under this yacht experience.",
    });
    return true;
  }

  async function deleteReference(id?: string) {
    if (!profile.id || !id) return;
    const response = await deleteRelatedRecord("reference", id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function savePortfolioPhoto(item: PortfolioPhoto) {
    if (!profile.id) return;
    const response = await saveRelatedRecord("portfolio", item, item.id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function deletePortfolioPhoto(id?: string) {
    if (!profile.id || !id) return;
    const response = await deleteRelatedRecord("portfolio", id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  function cancelUpload() {
    uploadRunRef.current += 1;
    setUploading("");
    setUploadError("");
  }

  async function uploadFile(file: File, bucket: UploadBucket, slot: string = bucket) {
    if (!profile.id) return "";
    const uploadRun = uploadRunRef.current + 1;
    uploadRunRef.current = uploadRun;
    setUploadError("");
    setUploading(slot);
    const path = createSafeStoragePath(profile.id, file);

    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file);

      if (uploadRun !== uploadRunRef.current) {
        if (!error) await supabase.storage.from(bucket).remove([path]);
        return "";
      }

      if (error) {
        setUploadError(formatUploadError(error.message));
        return "";
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } finally {
      if (uploadRun === uploadRunRef.current) {
        setUploading((current) => (current === slot ? "" : current));
      }
    }
  }

  async function saveRelatedRecord(kind: RelatedKind, payload: Record<string, unknown>, id?: string) {
    return callRelatedApi({ action: "save", kind, payload, id });
  }

  async function deleteRelatedRecord(kind: RelatedKind, id: string) {
    return callRelatedApi({ action: "delete", kind, id });
  }

  async function callRelatedApi(input: {
    action: "save" | "delete";
    kind: RelatedKind;
    payload?: Record<string, unknown>;
    id?: string;
  }) {
    if (!profile.id) return { ok: false, error: "Crew profile is not loaded." };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/login";
      return { ok: false, error: "Login session is required." };
    }

    const response = await fetch("/api/crew-profile/related", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...input, profileId: profile.id }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!response.ok || !result?.ok) {
      return { ok: false, error: result?.error || "Crew profile record could not be saved." };
    }

    return { ok: true, error: "" };
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <main className="bd-ocean-shell min-h-screen p-8 text-slate-900">
        <div className="bd-ocean-content">Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="bd-ocean-shell min-h-screen px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="bd-ocean-content mx-auto max-w-[1520px]">
        <header className="bd-glass-card-strong overflow-hidden rounded-[30px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#07111f_0%,#0891b2_45%,#2d7482_100%)]" />
          <div className="grid gap-0 xl:grid-cols-[1fr_420px]">
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">BlueDeck Profile</p>
              <h1 className="bd-serif mt-3 text-4xl font-normal text-[#071f3c] sm:text-5xl">
                {profile.full_name || "Professional Crew Profile"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Build a clean yachting CV from verified profile data, documents,
                work preferences, skills, references and portfolio.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                <Snapshot label="Crew ID" value={profile.public_crew_id || "-"} tone="navy" />
                <Snapshot label="Experience" value={`${totalExperienceYears} yrs`} tone="cyan" />
                <Snapshot label="Documents" value={String(documents.length)} tone="gold" />
                <Snapshot label="Alerts" value={String(expiryAlerts.length)} tone="rose" />
              </div>
            </div>
            <div className="border-t border-cyan-100 bg-[#f8fcfd] p-5 xl:border-l xl:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Actions</p>
              <div className="mt-4 grid gap-2">
                <button onClick={saveProfile} className="rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-900">
                  {saving ? "Saving..." : "Save profile"}
                </button>
                <Link href="/contracts" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300">
                  Contracts
                </Link>
                <Link href="/crew/tasks" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300">
                  My checklists
                </Link>
              </div>
            </div>
          </div>
        </header>

        {expiryAlerts.length > 0 && (
          <section className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/90 p-4 text-amber-950 shadow-sm backdrop-blur">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <h2 className="font-semibold text-amber-950">Documents expiring within 3 months</h2>
                <p className="mt-1 text-sm text-amber-900/80">
                  {expiryAlerts.map((item) => `${item.document_type}: ${item.expiry_date}`).join(" · ")}
                </p>
              </div>
            </div>
          </section>
        )}

        {uploadError && (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
                <div>
                  <h2 className="font-semibold text-rose-950">Upload failed</h2>
                  <p className="mt-1 text-sm leading-6 text-rose-800">{uploadError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadError("")}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Dismiss
              </button>
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <Panel title="Personal details" icon={<UserRound className="h-5 w-5" />}>
              <ProfilePhoto
                url={profile.profile_photo_url}
                name={profile.full_name}
                uploading={uploading === "profile-photo"}
                onCancelUpload={cancelUpload}
                onRemove={() => setProfile((current) => ({ ...current, profile_photo_url: "" }))}
                onUpload={async (file) => {
                  const url = await uploadFile(file, "crew-portfolio", "profile-photo");
                  if (url) setProfile((current) => ({ ...current, profile_photo_url: url }));
                }}
              />
              <Field label="Name and surname" value={profile.full_name} onChange={(value) => setProfile({ ...profile, full_name: value })} />
              <Field label="Email" value={profile.email} onChange={(value) => setProfile({ ...profile, email: value })} />
              <DropdownChoiceGroup title="Position" options={yachtPositionTitles} value={profile.current_positions || []} onChange={(value) => setProfile({ ...profile, current_positions: value, current_position: value[0] || "" })} />
              <PhoneInput label="Mobile number" value={profile.phone || ""} onChange={(value) => setProfile({ ...profile, phone: value })} />
              <DateField label="Date of birth" value={profile.date_of_birth} onChange={(value) => setProfile({ ...profile, date_of_birth: value })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height cm" type="number" value={String(profile.height_cm || "")} onChange={(value) => setProfile({ ...profile, height_cm: Number(value) || undefined })} />
                <Field label="Weight kg" type="number" value={String(profile.weight_kg || "")} onChange={(value) => setProfile({ ...profile, weight_kg: Number(value) || undefined })} />
              </div>
              <NationalitySelect value={profile.nationality || ""} onChange={(value) => setProfile({ ...profile, nationality: value })} />
              <LocationSelect value={profile.location || ""} onChange={(value) => setProfile({ ...profile, location: value })} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Smoker" value={profile.smoker || ""} options={["No", "Yes"]} onChange={(value) => setProfile({ ...profile, smoker: value })} />
                <SelectField label="Visible tattoos" value={profile.visible_tattoos || ""} options={["No", "Yes"]} onChange={(value) => setProfile({ ...profile, visible_tattoos: value })} />
              </div>
              <TextArea label="Professional summary" value={profile.bio || ""} onChange={(value) => setProfile({ ...profile, bio: value })} />
            </Panel>

            <Panel title="Languages" icon={<Languages className="h-5 w-5" />}>
              <LanguagePicker
                value={profile.languages || []}
                onChange={(languages) => setProfile({ ...profile, languages })}
              />
            </Panel>
          </aside>

          <div className="space-y-5">
            <Panel title="Yacht experience" icon={<BriefcaseBusiness className="h-5 w-5" />}>
              <div className="space-y-4">
                {referenceStatus && (
                  <p
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      referenceStatus.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {referenceStatus.message}
                  </p>
                )}
                {[emptyExperience, ...editableExperiences].map((item) => {
                  const isNewExperience = !item.id;
                  const uploadSlot = item.id ? `experience-photo-${item.id}` : `experience-photo-new-${experiences.length}`;
                  const linkedReferences = referencesForExperience(item, references);

                  return (
                    <ExperienceEditor
                      key={item.id || `new-${experiences.length}`}
                      item={item}
                      isNew={isNewExperience}
                      references={linkedReferences}
                      referenceSaving={referenceSaving}
                      onSave={saveExperience}
                      onDelete={deleteExperience}
                      onSaveReference={saveReference}
                      onDeleteReference={deleteReference}
                      onUpload={async (file) => uploadFile(file, "crew-portfolio", uploadSlot)}
                      onCancelUpload={cancelUpload}
                      uploading={uploading === uploadSlot}
                    />
                  );
                })}
              </div>
            </Panel>

            <Panel title="Documents" icon={<IdCard className="h-5 w-5" />}>
              <DocumentCreator
                draft={documentDraft}
                setDraft={setDocumentDraft}
                onSave={saveDocument}
                onUpload={async (file) => {
                  const url = await uploadFile(file, "crew-documents", "document-file");
                  if (url) setDocumentDraft((current) => ({ ...current, file_url: url }));
                }}
                onCancelUpload={cancelUpload}
                uploading={uploading === "document-file"}
              />
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onChange={updateDocument}
                    onDelete={deleteDocument}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Portfolio photos" icon={<Camera className="h-5 w-5" />}>
              <div className="grid gap-4 lg:grid-cols-2">
                {[...portfolio, emptyPhoto].map((item, index) => {
                  const uploadSlot = item.id ? `portfolio-photo-${item.id}` : `portfolio-photo-new-${index}`;

                  return (
                    <PortfolioEditor
                      key={item.id || `new-${index}`}
                      item={item}
                      isNew={!item.id}
                      onSave={savePortfolioPhoto}
                      onDelete={deletePortfolioPhoto}
                      onUpload={async (file) => uploadFile(file, "crew-portfolio", uploadSlot)}
                      onCancelUpload={cancelUpload}
                      uploading={uploading === uploadSlot}
                    />
                  );
                })}
              </div>
            </Panel>

            <Panel title="Work preferences" icon={<Star className="h-5 w-5" />}>
              <DropdownChoiceGroup title="Select preferences" options={workPreferences} value={profile.work_preferences || []} onChange={(value) => setProfile({ ...profile, work_preferences: value })} />
            </Panel>

            <Panel title="Skills & characteristics" icon={<Check className="h-5 w-5" />}>
              <DropdownChoiceGroup title="Personal skills" options={personalSkills} value={profile.personal_skills || []} onChange={(value) => setProfile({ ...profile, personal_skills: value })} />
              <DropdownChoiceGroup title="Personal characteristics" options={characteristics} value={profile.personal_characteristics || []} onChange={(value) => setProfile({ ...profile, personal_characteristics: value })} />
              <DropdownChoiceGroup title="Seeking positions" options={yachtPositionTitles} value={profile.seeking_positions || []} onChange={(value) => setProfile({ ...profile, seeking_positions: value })} />
            </Panel>

            <SeazoneStyleCvPreview
              profile={profile}
              documents={cvDocuments}
              experiences={experiences}
              references={cvReferences}
              portfolio={portfolio}
              totalExperienceYears={totalExperienceYears}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function DocumentCreator({
  draft,
  setDraft,
  onSave,
  onUpload,
  onCancelUpload,
  uploading,
}: {
  draft: CrewDocument;
  setDraft: (draft: CrewDocument) => void;
  onSave: () => void;
  onUpload: (file: File) => void | Promise<void>;
  onCancelUpload: () => void;
  uploading: boolean;
}) {
  const selectedCategory = documentCatalog.find((group) => group.items.includes(draft.document_type))?.category || "";

  return (
    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-600">Document type</span>
          <select
            value={draft.document_type}
            onChange={(event) => {
              const category = documentCatalog.find((group) => group.items.includes(event.target.value))?.category || "";
              setDraft({ ...draft, document_type: event.target.value, category });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-cyan-500"
          >
            <option value="">Select document</option>
            {documentCatalog.map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.items.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Field label="Issuer / authority" value={draft.issuer} onChange={(value) => setDraft({ ...draft, issuer: value })} />
        <DateField label="Issue date" value={draft.issue_date} onChange={(value) => setDraft({ ...draft, issue_date: value })} />
        <DateField label="Expiry date" value={draft.expiry_date} onChange={(value) => setDraft({ ...draft, expiry_date: value })} disabled={draft.no_expiry} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Checkbox label="No expiry / unlimited" checked={draft.no_expiry} onChange={(checked) => setDraft({ ...draft, no_expiry: checked, expiry_date: checked ? "" : draft.expiry_date })} />
        <Checkbox label="Show on CV" checked={draft.show_on_cv} onChange={(checked) => setDraft({ ...draft, show_on_cv: checked })} />
        <label className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition ${uploading ? "cursor-progress opacity-70" : "cursor-pointer hover:border-cyan-300"}`}>
          <Upload className="h-4 w-4 text-cyan-700" />
          {uploading ? "Uploading..." : draft.file_url ? "File attached" : "Attach file/photo"}
          <input
            type="file"
            disabled={uploading}
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
        {uploading && (
          <button type="button" onClick={onCancelUpload} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
            Cancel upload
          </button>
        )}
        {draft.file_url && !uploading && (
          <button type="button" onClick={() => setDraft({ ...draft, file_url: "" })} className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
            Remove file
          </button>
        )}
        <button type="button" onClick={onSave} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#020817]">
          Add document
        </button>
      </div>
      {selectedCategory && <p className="mt-3 text-xs text-slate-500">Category: {selectedCategory}</p>}
    </div>
  );
}

function languageLevelWidth(level: string) {
  const widths: Record<string, string> = {
    Basic: "30%",
    Intermediate: "52%",
    Advanced: "72%",
    Fluent: "88%",
    Native: "100%",
  };
  return widths[level] || "55%";
}

function formatCvDate(value?: string) {
  if (!value) return "-";
  const display = formatDateForDisplay(value);
  return display || value;
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

function cleanReferenceEntries(references: ReferenceEntry[]) {
  return references.filter((reference) =>
    Boolean(reference.name || reference.role || reference.vessel || reference.company || reference.phone || reference.email),
  );
}

function phoneCountryFromValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  return (
    [...blueDeckCountries]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((country) => normalized.startsWith(country.dial)) || null
  );
}

function localPhoneFromValue(value: string, country: PhoneCountryOption | null) {
  let local = value.trim();
  if (country && local.startsWith(country.dial)) local = local.slice(country.dial.length).trim();
  return local.replace(/^\+/, "");
}

function composeReferencePhone(country: PhoneCountryOption | null, localNumber: string) {
  const cleanLocal = localNumber.replace(/[^\d\s()-]/g, "").trim();
  if (!country) return cleanLocal;
  return cleanLocal ? `${country.dial} ${cleanLocal}` : country.dial;
}

function referenceMatchesExperience(reference: ReferenceEntry, experience: Experience) {
  const vessel = normalizeVesselName(reference.vessel);
  const yacht = normalizeVesselName(experience.yacht_name);
  if (!vessel || !yacht) return false;
  if (vessel === yacht) return true;
  return vessel.length >= 3 && yacht.length >= 3 && (vessel.includes(yacht) || yacht.includes(vessel));
}

function referencesForExperience(experience: Experience, references: ReferenceEntry[]) {
  return references.filter((reference) => referenceMatchesExperience(reference, experience));
}

function unmatchedExperienceReferences(experiences: Experience[], references: ReferenceEntry[]) {
  return references.filter((reference) => !experiences.some((experience) => referenceMatchesExperience(reference, experience)));
}

function SeazoneStyleCvPreview({
  profile,
  documents,
  experiences,
  references,
  portfolio,
  totalExperienceYears,
}: {
  profile: CrewProfile;
  documents: CrewDocument[];
  experiences: Experience[];
  references: ReferenceEntry[];
  portfolio: PortfolioPhoto[];
  totalExperienceYears: string;
}) {
  const primaryPosition = profile.current_positions?.[0] || profile.current_position || "Yacht Crew";
  const cleanExperiences = experiences.filter((item) => item.yacht_name || item.position || item.description);
  const cleanReferences = cleanReferenceEntries(references);
  const standaloneReferences = unmatchedExperienceReferences(cleanExperiences, cleanReferences);
  const cleanPortfolio = portfolio.filter((photo) => photo.image_url);
  const visibleSkills = [...(profile.personal_skills || []), ...(profile.personal_characteristics || [])].slice(0, 18);
  const professionalSummary =
    profile.bio?.trim() ||
    `I am a ${primaryPosition.toLowerCase()} looking for a professional yacht opportunity. I am reliable, guest-focused and ready to contribute to a well-run crew.`;

  return (
    <section
      id="bluedeck-cv"
      className="overflow-hidden rounded-[24px] border border-[#d8e2e6] bg-[#f3f7f8] text-slate-950 shadow-xl shadow-slate-950/10 print:rounded-none print:border-0 print:bg-white print:shadow-none"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#b9c8cd] bg-white px-5 py-4 print:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#228fc4]">BlueDeck crew CV</p>
          <p className="mt-1 text-sm text-slate-500">Minimal maritime CV generated from your saved profile.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#06111f] px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20"
        >
          <Download className="h-4 w-4" />
          Save as PDF
        </button>
      </div>

      <div className="bg-[#f3f7f8] p-3 sm:p-5 print:p-0">
        <div className="mx-auto max-w-[980px] overflow-hidden rounded-[18px] border border-[#d8e2e6] bg-white shadow-xl shadow-slate-950/10 print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="grid min-h-[1120px] bg-white lg:grid-cols-[320px_1fr] print:min-h-0 print:grid-cols-[300px_1fr]">
            <aside className="relative bg-[#e7ecee] px-7 pb-8 pt-52 text-[#242a31] print:pt-48">
              <div className="absolute left-1/2 top-9 z-10 h-44 w-44 -translate-x-1/2 overflow-hidden rounded-full border-[10px] border-white bg-white shadow-xl shadow-slate-950/12">
                {profile.profile_photo_url ? (
                  <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#edf3f5] text-[#2d7482]">
                    <UserRound className="h-16 w-16" />
                  </div>
                )}
              </div>

              <div className="space-y-8">
                <SeazoneSideSection title="About Me">
                  <p className="text-[14px] leading-7 text-[#3d454c]">{professionalSummary}</p>
                </SeazoneSideSection>

                <SeazoneSideSection title="Profile">
                  <div className="space-y-2.5">
                    <SeazoneSidebarLine label="Date of Birth" value={formatCvDate(profile.date_of_birth)} />
                    <SeazoneSidebarLine label="Nationality" value={profile.nationality || "-"} />
                    <SeazoneSidebarLine label="Experience" value={`${totalExperienceYears}y`} />
                  </div>
                </SeazoneSideSection>

                <SeazoneSideSection title="Contact">
                  <div className="space-y-2.5 text-sm font-semibold text-[#3d454c]">
                    <p className="break-words">{profile.phone || "-"}</p>
                    <p className="break-words">{profile.email || "-"}</p>
                    <p className="break-words">{profile.location || "-"}</p>
                  </div>
                </SeazoneSideSection>

                <SeazoneSideSection title="Documents">
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-sm text-[#6b747a]">No CV documents selected.</p>}
                    {documents.slice(0, 8).map((doc) => (
                      <SeazoneDocumentRow key={doc.id || doc.document_type} document={doc} />
                    ))}
                  </div>
                </SeazoneSideSection>

                <SeazoneSideSection title="Skills">
                  <PillList items={visibleSkills} light />
                </SeazoneSideSection>

                <SeazoneSideSection title="Language">
                  <div className="space-y-3">
                    {profile.languages?.length ? (
                      profile.languages.map((language) => (
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
                </SeazoneSideSection>

                <SeazoneSideSection title="Preferences">
                  <PillList items={profile.work_preferences || []} light />
                </SeazoneSideSection>

                <div className="rounded-2xl border border-[#cbd7dc] bg-white p-4 text-[#40535d]">
                  <CrewProfileQr crewId={profile.public_crew_id} />
                  <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#6b747a]">{profile.public_crew_id || "Crew ID"}</p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#2d7482]">Public CV Access</p>
                  <p className="mt-1 text-sm font-semibold">Scan the QR code to open this crew CV on BlueDeck.</p>
                </div>
              </div>
            </aside>

            <div className="bg-white">
              <header className="bg-[#07131f] px-8 py-8 text-white sm:px-10 print:px-8">
                <div className="flex min-h-[132px] flex-col justify-center gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8ed8e6]">Verified Crew Profile</p>
                    <h2 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">{profile.full_name || "Crew Member"}</h2>
                    <p className="mt-3 text-lg font-semibold tracking-[0.18em] text-white/80">{primaryPosition}</p>
                  </div>
                  <div className="flex items-center gap-4 rounded-2xl border border-white/14 bg-white/8 p-4 shadow-lg shadow-black/10">
                    <BlueDeckMark className="h-14 w-24 rounded-xl border-white/20 bg-white/10 shadow-none" imageClassName="p-1" />
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white">BlueDeck</p>
                      <p className="mt-1 text-sm font-semibold text-white/68">Yachtos CV</p>
                    </div>
                  </div>
                </div>
              </header>

              <main className="p-6 sm:p-8 print:p-7">
                <SeazoneSection title="Yacht Experience" badge={`${totalExperienceYears} years`}>
                <div className="space-y-4">
                  {cleanExperiences.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#c7d2d6] bg-[#f6f8f8] p-5 text-sm text-[#5a6870]">
                      No yacht experience added yet.
                    </p>
                  )}
                  {cleanExperiences.map((item) => (
                    <SeazoneExperienceCard
                      key={item.id || `${item.yacht_name}-${item.start_date}`}
                      experience={item}
                      references={referencesForExperience(item, cleanReferences)}
                    />
                  ))}
                </div>
              </SeazoneSection>

              {standaloneReferences.length > 0 && (
                <SeazoneSection title="References">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {standaloneReferences.slice(0, 4).map((ref) => (
                      <div key={ref.id || ref.email || ref.name} className="rounded-xl border border-[#c7d2d6] bg-[#f6f8f8] p-4">
                        <p className="font-black text-[#06111f]">{ref.name || "Reference"}</p>
                        <p className="mt-1 text-sm font-semibold text-[#2d7482]">{[ref.role, ref.vessel || ref.company].filter(Boolean).join(" / ") || "Yacht reference"}</p>
                        <p className="mt-2 text-xs text-[#5a6870]">{[ref.email, ref.phone].filter(Boolean).join(" / ")}</p>
                      </div>
                    ))}
                  </div>
                </SeazoneSection>
              )}

              {cleanPortfolio.length > 0 && (
                <SeazoneSection title="Portfolio">
                  <div className="grid grid-cols-3 gap-3">
                    {cleanPortfolio.slice(0, 6).map((photo) => (
                      <figure key={photo.id || photo.image_url} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img src={photo.image_url} alt={photo.title || "Portfolio"} className="h-28 w-full object-cover" />
                        {(photo.title || photo.location) && (
                          <figcaption className="px-3 py-2 text-xs font-semibold text-slate-600">
                            {photo.title || photo.location}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </SeazoneSection>
              )}

              <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
                This CV is generated from verified BlueDeck profile data and can be updated from any device.
              </footer>
            </main>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CrewProfileQr({ crewId }: { crewId?: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const profileUrl = useMemo(
    () => (crewId ? absoluteSiteUrl(`/crew/${encodeURIComponent(crewId)}`) : ""),
    [crewId],
  );

  useEffect(() => {
    let cancelled = false;

    if (!profileUrl) {
      return;
    }

    void toDataURL(profileUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 192,
      color: {
        dark: "#173f4a",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [profileUrl]);

  if (!profileUrl) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#f4f8fb] p-3 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        Save profile
      </div>
    );
  }

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative flex h-24 items-center justify-center rounded-xl border border-[#d8e2e6] bg-white p-2 shadow-sm transition hover:border-[#2d7482]"
      title={`Open public CV: ${profileUrl}`}
    >
      {qrDataUrl ? (
        <img src={qrDataUrl} alt={`QR code for BlueDeck CV ${crewId}`} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">QR loading</span>
      )}
      <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#173f4a] text-white shadow-lg shadow-[#173f4a]/20 opacity-0 transition group-hover:opacity-100">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

function SeazoneSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-[#b9c8cd] pb-2">
        <h3 className="text-[13px] font-black uppercase tracking-[0.14em] text-[#06111f]">{title}</h3>
        {badge && <span className="rounded-full bg-[#173f4a] px-3 py-1 text-[11px] font-black text-white shadow-sm shadow-[#173f4a]/20">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function SeazoneSideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-4">
        <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#242a31]">{title}</h3>
        <div className="h-px flex-1 bg-[#242a31]/45" />
      </div>
      {children}
    </section>
  );
}

function SeazoneSidebarLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#cbd7dc] pb-2 text-[13px] last:border-b-0 last:pb-0">
      <p className="font-semibold text-[#6b747a]">{label}</p>
      <p className="break-words text-right font-black text-[#242a31]">{value}</p>
    </div>
  );
}

function SeazoneExperienceCard({ experience, references }: { experience: Experience; references: ReferenceEntry[] }) {
  return (
    <article className="rounded-2xl border border-[#d8e2e6] bg-white p-3 shadow-sm shadow-slate-950/5">
      <div className="grid items-start gap-3 sm:grid-cols-[136px_1fr]">
        <div className="rounded-xl border border-[#d8e2e6] bg-[#f6f8f8] p-2">
          {experience.photo_url ? (
            <img src={experience.photo_url} alt={experience.yacht_name || "Yacht"} className="h-24 w-full rounded-lg object-cover" />
          ) : (
            <div className="h-24 rounded-lg bg-[linear-gradient(135deg,#f5f8f9,#e8f0f2)]" />
          )}
          <div className="mt-3">
            <h4 className="text-[15px] font-black leading-tight text-[#06111f]">{experience.yacht_name || "Yacht"}</h4>
            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#2d7482]">{formatDateRange(experience.start_date, experience.end_date)}</p>
            <span className="mt-2 inline-flex rounded-md bg-[#173f4a] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
              {experience.position || "Position"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#dbe4e7] bg-[#f6f8f8] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b7b84]">Duties</p>
            <p className="mt-2 text-[13px] leading-5 text-[#364650]">
              {experience.description || "Responsibilities and onboard duties will appear here."}
            </p>
            <SeazoneExperienceReferences references={references} />
        </div>
      </div>
    </article>
  );
}

function SeazoneExperienceReferences({ references }: { references: ReferenceEntry[] }) {
  if (references.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[#c7d2d6] pt-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2d7482]">Reference</p>
      <div className="mt-2 grid gap-2">
        {references.slice(0, 2).map((reference) => (
          <div key={reference.id || reference.email || reference.phone || reference.name} className="rounded-lg border border-[#d8e2e6] bg-white px-3 py-2">
            <p className="text-[13px] font-black text-[#06111f]">{reference.name || "Reference"}</p>
            <p className="mt-1 text-xs font-semibold text-[#2d7482]">
              {[reference.role, reference.vessel || reference.company].filter(Boolean).join(" / ") || "Yacht reference"}
            </p>
            {(reference.email || reference.phone) && (
              <p className="mt-1 text-xs text-[#5a6870]">{[reference.email, reference.phone].filter(Boolean).join(" / ")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SeazoneDocumentRow({ document }: { document: CrewDocument }) {
  const expiring = !document.no_expiry && isWithin90Days(document.expiry_date);
  return (
    <div className={`rounded-xl border px-4 py-3 ${expiring ? "border-[#d8b4a0] bg-[#fff7f3]" : "border-[#c7d2d6] bg-[#f6f8f8]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-[#06111f]">{document.document_type}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7a858b]">{document.category || "Certificate"}</p>
        </div>
        <p className={expiring ? "text-xs font-black text-[#9a4b2e]" : "text-xs font-black text-[#2d7482]"}>
          {document.no_expiry ? "No expiry" : formatCvDate(document.expiry_date)}
        </p>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="h-1 bg-[linear-gradient(90deg,#07111f,#0891b2,#2d7482)]" />
      <div className="p-4">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0e7490,#67e8f9)] text-white shadow-lg shadow-cyan-900/15">{icon}</div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="space-y-3.5">{children}</div>
      </div>
    </section>
  );
}

function ProfilePhoto({
  url,
  name,
  uploading,
  onUpload,
  onCancelUpload,
  onRemove,
}: {
  url?: string;
  name?: string;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onCancelUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-100">
        {url ? <img src={url} alt={name || "Profile"} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-400"><UserRound className="h-10 w-10" /></div>}
      </div>
      <div>
        <p className="font-semibold text-slate-950">Profile photo</p>
        <p className="mt-1 text-sm text-slate-500">This appears in your portal and CV.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className={`inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition ${uploading ? "cursor-progress opacity-70" : "cursor-pointer hover:bg-cyan-900"}`}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : url ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) onUpload(file);
              }}
            />
          </label>
          {uploading && (
            <button type="button" onClick={onCancelUpload} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
              Cancel
            </button>
          )}
          {url && !uploading && (
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DropdownChoiceGroup({ title, options, value, onChange }: { title: string; options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const selectedText = value.length ? value.join(", ") : "Select";

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen(!open);
        }}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm"
      >
        <span>{title}</span>
        <span className="max-w-[58%] truncate text-right text-xs text-cyan-700">{selectedText}</span>
      </button>
      {value.length > 0 && <PillList items={value} light />}
      {open && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-[#fbfaf7] p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((option) => {
              const selected = draft.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraft(selected ? draft.filter((item) => item !== option) : [...draft, option])}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${selected ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-cyan-400"}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setOpen(false);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguagePicker({ value, onChange }: { value: LanguageEntry[]; onChange: (value: LanguageEntry[]) => void }) {
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [customLanguage, setCustomLanguage] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Intermediate");

  const selectedNames = value.map((item) => item.name.toLowerCase());
  const availableLanguages = languageOptions.filter(
    (language) => !selectedNames.includes(language.toLowerCase())
  );
  const languageName =
    selectedLanguage === "__custom__" ? customLanguage.trim() : selectedLanguage;
  const canAdd =
    Boolean(languageName) &&
    Boolean(selectedLevel) &&
    !selectedNames.includes(languageName.toLowerCase());

  function addLanguage() {
    if (!canAdd) return;
    onChange([...value, { name: languageName, level: selectedLevel }]);
    setSelectedLanguage("");
    setCustomLanguage("");
    setSelectedLevel("Intermediate");
  }

  function updateLanguageLevel(name: string, level: string) {
    onChange(
      value.map((item) => (item.name === name ? { ...item, level } : item))
    );
  }

  function removeLanguage(name: string) {
    onChange(value.filter((item) => item.name !== name));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,#f8fdff,#ffffff_52%,#f2fbff)] p-4 shadow-sm shadow-cyan-950/5">
        <div className="grid gap-3">
          <select
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          >
            <option value="">Select language</option>
            {availableLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
            <option value="__custom__">Add another language</option>
          </select>

          {selectedLanguage === "__custom__" && (
            <input
              value={customLanguage}
              onChange={(event) => setCustomLanguage(event.target.value)}
              placeholder="Language name"
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              value={selectedLevel}
              onChange={(event) => setSelectedLevel(event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            >
              {languageLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addLanguage}
              disabled={!canAdd}
              className="bd-focus inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <Plus className="h-4 w-4" />
              Add language
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {value.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            No languages added yet.
          </p>
        )}

        {value.map((language) => (
          <div
            key={language.name}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-cyan-950/5 sm:grid-cols-[1fr_150px_auto] sm:items-center"
          >
            <div>
              <p className="font-black text-slate-950">{language.name}</p>
            </div>
            <select
              value={language.level}
              onChange={(event) =>
                updateLanguageLevel(language.name, event.target.value)
              }
              className="h-11 rounded-xl border border-slate-200 bg-[#fbfaf7] px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-400"
            >
              {languageLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeLanguage(language.name)}
              className="bd-focus flex h-11 w-full items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-[#b9423b] transition hover:border-rose-200 hover:bg-rose-100 sm:w-11"
              title={`Remove ${language.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentCard({ document, onChange, onDelete }: { document: CrewDocument; onChange: (document: CrewDocument) => void; onDelete: (id?: string) => void }) {
  const alert = !document.no_expiry && isWithin90Days(document.expiry_date);
  return (
    <article className={`rounded-2xl border p-4 ${alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{document.document_type}</p>
          <p className="mt-1 text-xs text-slate-500">{document.category}</p>
        </div>
        <button onClick={() => onDelete(document.id)} className="text-red-200"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DateField label="Issue" value={document.issue_date} onChange={(value) => onChange({ ...document, issue_date: value })} />
        <DateField label="Expiry" value={document.expiry_date} disabled={document.no_expiry} onChange={(value) => onChange({ ...document, expiry_date: value })} />
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <Checkbox label="No expiry" checked={document.no_expiry} onChange={(checked) => onChange({ ...document, no_expiry: checked, expiry_date: checked ? "" : document.expiry_date })} />
        <Checkbox label="Show on CV" checked={document.show_on_cv} onChange={(checked) => onChange({ ...document, show_on_cv: checked })} />
      </div>
      {alert && <p className="mt-3 text-sm text-amber-100">Expiry alert: update this document soon.</p>}
    </article>
  );
}

function ExperienceEditor({
  item,
  isNew,
  references,
  referenceSaving,
  onSave,
  onDelete,
  onSaveReference,
  onDeleteReference,
  onUpload,
  onCancelUpload,
  uploading,
}: {
  item: Experience;
  isNew: boolean;
  references: ReferenceEntry[];
  referenceSaving: boolean;
  onSave: (item: Experience) => void;
  onDelete: (id?: string) => void;
  onSaveReference: (item: ReferenceEntry) => Promise<boolean>;
  onDeleteReference: (id?: string) => void;
  onUpload: (file: File) => Promise<string>;
  onCancelUpload: () => void;
  uploading: boolean;
}) {
  const [draft, setDraft] = useState(item);

  function removePhoto() {
    const nextDraft = { ...draft, photo_url: "" };
    setDraft(nextDraft);
    if (!isNew) onSave(nextDraft);
  }

  async function saveLinkedReference(reference: ReferenceEntry) {
    const yachtName = draft.yacht_name.trim();

    if (!yachtName) {
      alert("Add the yacht name before saving a reference.");
      return false;
    }

    return onSaveReference({
      ...reference,
      name: (reference.name || reference.company).trim(),
      vessel: yachtName,
      company: "",
      notes: "",
      show_on_cv: true,
    });
  }

  return (
    <article className="rounded-2xl border border-[#d8e2e6] bg-white p-2.5 shadow-sm shadow-slate-950/5">
      <div className="grid items-stretch gap-3 sm:grid-cols-[128px_1fr]">
        <div className="flex min-h-full flex-col rounded-xl border border-[#d8e2e6] bg-[#f6f8f8] p-2">
          <div className="relative overflow-hidden rounded-lg border border-[#d8e2e6] bg-white">
            {draft.photo_url ? (
              <img src={draft.photo_url} alt={draft.yacht_name || "Yacht"} className="h-20 w-full object-cover" />
            ) : (
              <div className="flex h-20 items-center justify-center bg-[linear-gradient(135deg,#f5f8f9,#e8f0f2)] text-[#6b7b84]">
                <Camera className="h-5 w-5" />
              </div>
            )}
            <label className={`absolute inset-x-2 bottom-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#06111f]/85 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-slate-950/20 transition hover:bg-[#173f4a] ${uploading ? "cursor-progress opacity-80" : ""}`}>
              <Upload className="h-3 w-3" />
              {uploading ? "Uploading" : draft.photo_url ? "Change" : "Photo"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="hidden"
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  const url = await onUpload(file);
                  if (url) setDraft((current) => ({ ...current, photo_url: url }));
                }}
              />
            </label>
          </div>

          <div className="mt-3 space-y-2">
            <ExperienceCardInput
              label="Yacht name"
              value={draft.yacht_name}
              placeholder="Yacht"
              strong
              onChange={(value) => setDraft({ ...draft, yacht_name: value })}
            />
            <div className="grid gap-1.5">
              <ExperienceCardDateField label="Start date" value={draft.start_date} onChange={(value) => setDraft({ ...draft, start_date: value })} />
              <ExperienceCardDateField label="End date" value={draft.end_date} onChange={(value) => setDraft({ ...draft, end_date: value })} />
            </div>
            <label className="block">
              <span className="sr-only">Position</span>
              <select
                value={draft.position || ""}
                onChange={(event) => setDraft({ ...draft, position: event.target.value })}
                className="w-full cursor-pointer appearance-none rounded-md border border-[#173f4a] bg-[#173f4a] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white outline-none transition focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/20"
              >
                <option value="">Position</option>
                {yachtPositionTitles.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {uploading && (
              <button type="button" onClick={onCancelUpload} className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
                Cancel
              </button>
            )}
            {draft.photo_url && !uploading && (
              <button type="button" onClick={removePhoto} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-100 bg-white px-2 py-1 text-[10px] font-black text-rose-700 transition hover:bg-rose-50">
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-full flex-col rounded-xl border border-[#dbe4e7] bg-[#f6f8f8] p-3">
          <label className="flex flex-1 flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b7b84]">Duties</span>
            <textarea
              value={draft.description || ""}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Responsibilities and onboard duties"
              className="mt-2 min-h-24 flex-1 resize-y rounded-lg border border-[#d8e2e6] bg-white px-3 py-2.5 text-[13px] leading-5 text-[#364650] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15"
            />
          </label>
          <div className="mt-3 border-t border-[#c7d2d6] pt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2d7482]">Reference</p>
              <p className="text-[10px] font-semibold text-[#6b7b84]">Linked to this yacht</p>
            </div>
            <div className="space-y-2">
              {references.map((reference) => (
                <ExperienceReferenceEditor
                  key={reference.id || `${reference.name}-${reference.email}`}
                  item={reference}
                  isNew={false}
                  saving={referenceSaving}
                  onSave={saveLinkedReference}
                  onDelete={onDeleteReference}
                />
              ))}
              <ExperienceReferenceEditor
                key={`new-reference-${item.id || "draft"}`}
                item={emptyReference}
                isNew
                saving={referenceSaving}
                onSave={saveLinkedReference}
                onDelete={onDeleteReference}
              />
            </div>
          </div>
          <EditorButtons isNew={isNew} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Add experience" />
        </div>
      </div>
    </article>
  );
}

function ExperienceCardInput({
  label,
  value,
  placeholder,
  onChange,
  strong = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onChange: (value: string) => void;
  strong?: boolean;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-[#d8e2e6] bg-white px-2.5 py-2 outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15 ${strong ? "text-[15px] font-black leading-tight text-[#06111f]" : "text-[12px] font-semibold text-[#2d7482]"}`}
      />
    </label>
  );
}

function ExperienceCardDateField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const [display, setDisplay] = useState(formatDateForDisplay(value || ""));

  function commit(nextDisplay: string) {
    const formatted = formatDateTyping(nextDisplay);
    setDisplay(formatted);
    onChange(parseDisplayDate(formatted));
  }

  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        inputMode="numeric"
        value={display}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setDisplay(formatDateForDisplay(parseDisplayDate(display)))}
        placeholder={label}
        className="w-full rounded-lg border border-[#d8e2e6] bg-white px-2.5 py-1.5 text-[12px] font-semibold leading-5 text-[#2d7482] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15"
      />
    </label>
  );
}

function ExperienceReferenceEditor({
  item,
  isNew,
  saving,
  onSave,
  onDelete,
}: {
  item: ReferenceEntry;
  isNew: boolean;
  saving: boolean;
  onSave: (item: ReferenceEntry) => Promise<boolean>;
  onDelete: (id?: string) => void;
}) {
  const [draft, setDraft] = useState(item);
  const nameValue = draft.name || draft.company || "";

  async function handleSave() {
    const saved = await onSave({
      ...draft,
      name: nameValue.trim(),
      company: "",
      notes: "",
      show_on_cv: true,
    });
    if (saved && isNew) setDraft(emptyReference);
  }

  return (
    <div className="rounded-xl border border-[#d8e2e6] bg-white p-2 shadow-sm shadow-slate-950/5">
      <div className="grid items-center gap-2 lg:grid-cols-[1.05fr_0.7fr_1.2fr_1fr_auto]">
        <ReferenceMiniField
          label="Name / Company"
          value={nameValue}
          placeholder="Name / Company"
          onChange={(value) => setDraft({ ...draft, name: value, company: "" })}
        />
        <ReferenceMiniField
          label="Role"
          value={draft.role}
          placeholder="Role"
          onChange={(value) => setDraft({ ...draft, role: value })}
        />
        <ReferenceMiniPhoneField
          value={draft.phone}
          onChange={(value) => setDraft({ ...draft, phone: value })}
        />
        <ReferenceMiniField
          label="Email"
          value={draft.email}
          placeholder="Email"
          type="email"
          onChange={(value) => setDraft({ ...draft, email: value })}
        />
        <div className="flex gap-1.5 lg:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-[#173f4a] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#235866] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving" : isNew ? "Add" : "Save"}
          </button>
          {!isNew && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onDelete(draft.id)}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-rose-100 bg-white px-2.5 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Delete reference"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferenceMiniField({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value?: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-[#d8e2e6] bg-[#f6f8f8] px-2.5 text-[12px] font-semibold text-[#364650] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:bg-white focus:ring-2 focus:ring-[#2d7482]/15"
      />
    </label>
  );
}

function ReferenceMiniPhoneField({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manualCountry, setManualCountry] = useState<PhoneCountryOption | null>(null);
  const country = phoneCountryFromValue(value || "") || manualCountry;
  const localNumber = localPhoneFromValue(value || "", country);
  const filteredCountries = blueDeckCountries
    .filter((item) => `${item.country} ${item.nationality} ${item.code} ${item.dial}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 120);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <span className="sr-only">Phone</span>
      <div className="flex h-9 overflow-hidden rounded-lg border border-[#d8e2e6] bg-[#f6f8f8] transition focus-within:border-[#2d7482] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2d7482]/15">
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setQuery("");
          }}
          className={`flex w-[74px] shrink-0 cursor-pointer items-center justify-center gap-1 border-r border-[#d8e2e6] bg-white px-1.5 text-[11px] font-black transition hover:bg-[#eef7f8] ${country ? "text-[#06111f]" : "text-[#9aa8ae]"}`}
          aria-label="Select reference country code"
        >
          {country ? (
            <>
              <span>{country.flag}</span>
              <span>{country.dial}</span>
            </>
          ) : (
            <span>Code</span>
          )}
        </button>
        <input
          value={localNumber}
          onChange={(event) => onChange(composeReferencePhone(country, event.target.value))}
          inputMode="tel"
          autoComplete="tel"
          placeholder="Phone"
          className="min-w-0 flex-1 bg-transparent px-2 text-[12px] font-semibold text-[#364650] outline-none placeholder:text-[#9aa8ae]"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[min(330px,84vw)] overflow-hidden rounded-xl border border-[#d8e2e6] bg-white shadow-2xl shadow-slate-900/18">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search country..."
            className="h-9 w-full border-b border-[#d8e2e6] px-3 text-[12px] font-semibold text-[#364650] outline-none placeholder:text-[#9aa8ae]"
          />
          <div className="max-h-56 overflow-auto p-1.5">
            {filteredCountries.map((item) => (
              <button
                key={`${item.country}-${item.dial}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setManualCountry(item);
                  onChange(composeReferencePhone(item, localNumber));
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-[#364650] transition hover:bg-[#eef7f8]"
              >
                <span className="min-w-0 truncate">
                  {item.flag} {item.country}
                </span>
                <span className="shrink-0 font-black text-[#2d7482]">{item.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioEditor({
  item,
  isNew,
  onSave,
  onDelete,
  onUpload,
  onCancelUpload,
  uploading,
}: {
  item: PortfolioPhoto;
  isNew: boolean;
  onSave: (item: PortfolioPhoto) => void;
  onDelete: (id?: string) => void;
  onUpload: (file: File) => Promise<string>;
  onCancelUpload: () => void;
  uploading: boolean;
}) {
  const [draft, setDraft] = useState(item);

  function removePhoto() {
    const nextDraft = { ...draft, image_url: "" };
    setDraft(nextDraft);
    if (!isNew) onSave(nextDraft);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {draft.image_url && <img src={draft.image_url} alt={draft.title || "Portfolio"} className="mb-4 h-44 w-full rounded-xl object-cover" />}
      <Field label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
      <Field label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} />
      <div className="mt-4 flex flex-wrap gap-2">
        <label className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-slate-700 transition ${uploading ? "cursor-progress opacity-70" : "cursor-pointer hover:border-cyan-300 hover:text-cyan-800"}`}>
          <Upload className="h-4 w-4 text-cyan-700" />
          {uploading ? "Uploading..." : draft.image_url ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="hidden"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              const url = await onUpload(file);
              if (url) setDraft((current) => ({ ...current, image_url: url }));
            }}
          />
        </label>
        {uploading && (
          <button type="button" onClick={onCancelUpload} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
            Cancel upload
          </button>
        )}
        {draft.image_url && !uploading && (
          <button type="button" onClick={removePhoto} className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
            <Trash2 className="h-4 w-4" />
            Remove photo
          </button>
        )}
      </div>
      <EditorButtons isNew={isNew} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Save photo" />
    </div>
  );
}

function EditorButtons({
  isNew,
  onSave,
  onDelete,
  addLabel,
  saving = false,
}: {
  isNew: boolean;
  onSave: () => void | Promise<void>;
  onDelete: () => void;
  addLabel: string;
  saving?: boolean;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#020817] transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {saving ? "Saving..." : isNew ? addLabel : "Save"}
      </button>
      {!isNew && <button type="button" disabled={saving} onClick={onDelete} className="cursor-pointer rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">Delete</button>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  listId,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  listId?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <input type={type} value={value || ""} list={listId} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:opacity-40" />
    </label>
  );
}

function DateField({ label, value, onChange, disabled = false }: { label: string; value?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [display, setDisplay] = useState(formatDateForDisplay(value || ""));

  useEffect(() => {
    setDisplay(formatDateForDisplay(value || ""));
  }, [value]);

  function commit(nextDisplay: string) {
    const formatted = formatDateTyping(nextDisplay);
    setDisplay(formatted);
    onChange(parseDisplayDate(formatted));
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <input
        inputMode="numeric"
        placeholder="DD.MM.YYYY"
        value={display}
        disabled={disabled}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setDisplay(formatDateForDisplay(parseDisplayDate(display)))}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 disabled:opacity-40"
      />
    </label>
  );
}

function NationalitySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedCountry = nationalityOptions.find((country) => country.nationality === value);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">Nationality</span>
      <div className="rounded-xl border border-slate-200 bg-white">
        <CountrySearch
          selectedLabel={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.country} / ${selectedCountry.nationality}` : "Select nationality"}
          options={nationalityOptions}
          onSelect={(country) => onChange(country.nationality)}
          fullWidth
        />
      </div>
    </label>
  );
}

function CountrySearch({
  selectedLabel,
  options,
  onSelect,
  fullWidth = false,
  phoneMode = false,
}: {
  selectedLabel: string;
  options: CountryOption[];
  onSelect: (country: CountryOption) => void;
  fullWidth?: boolean;
  phoneMode?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedLabel, setPickedLabel] = useState(selectedLabel);
  const visibleLabel = pickedLabel || selectedLabel;
  const preferredCountries = options.filter((country) => {
    return country.code === "TR" || country.region === "Europe" || ["United States", "Russia", "United Arab Emirates", "Israel"].includes(country.country);
  });
  const source = query.trim() ? options : preferredCountries;
  const filtered = source
    .filter((country) => {
      const search = `${country.country} ${country.nationality} ${"dial" in country ? country.dial : ""}`.toLowerCase();
      return search.includes(query.toLowerCase());
    })
    .slice(0, query.trim() ? 80 : 60);
  const buttonLabel = visibleLabel.replace(" / ", " · ");

  useEffect(() => {
    if (!open) setPickedLabel(selectedLabel);
  }, [selectedLabel, open]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${fullWidth ? "w-full" : phoneMode ? "w-[135px] shrink-0" : "w-[170px] shrink-0"}`}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        className={`flex w-full items-center justify-between gap-2 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-950 transition hover:text-cyan-800 ${fullWidth ? "rounded-xl border-0 shadow-none" : phoneMode ? "rounded-l-xl" : "rounded-xl border border-slate-200 shadow-sm"}`}
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="text-cyan-700">⌄</span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(420px,92vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search country..."
            className="w-full border-b border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none"
          />
          <div className="max-h-72 overflow-auto p-2">
            {filtered.map((country) => (
              <button
                key={`${country.country}-${country.nationality}-${"dial" in country ? country.dial : ""}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const nextLabel = `${country.flag} ${"dial" in country ? `${country.code} ${country.dial}` : `${country.country} · ${country.nationality}`}`;
                  setPickedLabel(nextLabel);
                  setOpen(false);
                  setQuery("");
                  onSelect(country);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-cyan-50"
              >
                <span className="truncate">
                  {country.flag} {country.country} · {country.nationality}
                </span>
                {"dial" in country && <span className="shrink-0 font-semibold text-cyan-700">{country.dial}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LocationSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Array<{ label: string; detail: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=8&language=en&format=json`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as {
          results?: Array<{
            id: number;
            name: string;
            country?: string;
            admin1?: string;
            admin2?: string;
          }>;
        };
        const cleanResults = (data.results || []).map((item) => {
          const country = cleanLocationCountry(item.country);
          return {
            label: [item.name, country].filter(Boolean).join(", "),
            detail: [item.admin1, item.admin2].filter((part) => part && part !== item.name && part !== country).join(" · "),
          };
        });
        setSuggestions(cleanResults);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">Location</span>
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-cyan-500">
        <span className="flex items-center pl-3 text-cyan-700">
          <MapPin className="h-4 w-4" />
        </span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(event.target.value);
          }}
          placeholder="Search any city, marina or country"
          className="min-w-0 flex-1 px-3 py-3 text-sm text-slate-950 outline-none"
        />
      </div>
      {(suggestions.length > 0 || searching) && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          {searching && <p className="px-3 py-2 text-sm text-slate-500">Searching...</p>}
          {suggestions.map((location) => (
            <button
              key={`${location.label}-${location.detail}`}
              type="button"
              onClick={() => {
                setQuery(location.label);
                onChange(location.label);
                setSuggestions([]);
              }}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-cyan-50"
            >
              <span className="block font-semibold text-slate-900">{location.label}</span>
              {location.detail && <span className="block text-xs text-slate-500">{location.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function cleanLocationCountry(country?: string) {
  if (!country) return "";
  const replacements: Record<string, string> = {
    "Republic of Turkey": "Turkey",
    "Republic of Türkiye": "Turkey",
    "Türkiye": "Turkey",
    "United States of America": "United States",
    "Russian Federation": "Russia",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "United Arab Emirates": "UAE",
  };

  if (replacements[country]) return replacements[country];
  return country
    .replace(/^Republic of /, "")
    .replace(/^Kingdom of /, "")
    .replace(/^State of /, "")
    .replace(/^Commonwealth of /, "")
    .trim();
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-cyan-500">
        <option value="">Select</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500" />
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
      {label}
    </label>
  );
}

function Snapshot({ label, value, tone = "cyan" }: { label: string; value: string; tone?: "navy" | "cyan" | "gold" | "rose" }) {
  const tones = {
    navy: "border-slate-900/10 bg-slate-950 text-white",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    gold: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return <div className={`rounded-xl border p-3 ${tones[tone]}`}><p className="text-xs opacity-65">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function PillList({ items, light = false }: { items: string[]; light?: boolean }) {
  if (items.length === 0) return <p className={light ? "text-slate-500" : "text-slate-500"}>-</p>;
  return <div className="flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item}-${index}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${light ? "border border-slate-200 bg-white text-slate-700" : "bg-cyan-400/10 text-cyan-200"}`}>{item}</span>)}</div>;
}

function normalizeProfile(profile: CrewProfile) {
  return {
    ...profile,
    current_positions: profile.current_positions || [],
    seeking_positions: profile.seeking_positions || [],
    work_preferences: profile.work_preferences || [],
    personal_skills: profile.personal_skills || [],
    personal_characteristics: profile.personal_characteristics || [],
    languages: profile.languages || [],
  };
}

function newDocumentDraft(): CrewDocument {
  return { document_type: "", category: "", issuer: "", issue_date: "", expiry_date: "", no_expiry: false, show_on_cv: true, file_url: "", notes: "" };
}

function formatUploadError(message: string) {
  if (message === "Bucket not found") {
    return "File storage is not ready yet. Please create the required BlueDeck storage bucket in Supabase.";
  }

  if (/invalid key/i.test(message)) {
    return "This file name could not be accepted by storage. BlueDeck now creates a safe upload name automatically, so please try the upload again after refreshing the page.";
  }

  return message;
}

function isWithin90Days(dateString?: string) {
  if (!dateString) return false;
  const today = new Date();
  const expiry = new Date(dateString);
  const days = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 90;
}

function formatDateTyping(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join(".");
}

function parseDisplayDate(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return "";

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (dayNumber < 1 || dayNumber > 31 || monthNumber < 1 || monthNumber > 12 || yearNumber < 1900) return "";
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return formatDateTyping(value);
  return `${day}.${month}.${year}`;
}
