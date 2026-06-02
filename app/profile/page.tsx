"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Camera,
  Check,
  Download,
  FileText,
  IdCard,
  Languages,
  MapPin,
  Plus,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { BlueDeckMark } from "../components/BlueDeckLogo";
import { PhoneInput } from "../components/PhoneInput";
import { blueDeckCountries, nationalityOptions } from "../lib/countries";
import { saveBaseProfileById } from "../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { supabase } from "../lib/supabase";
import { yachtPositionTitles } from "../lib/yachtOperations";

type CountryOption = (typeof blueDeckCountries)[number] | (typeof nationalityOptions)[number];

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
  const [uploading, setUploading] = useState("");

  const cvDocuments = documents.filter((item) => item.show_on_cv);
  const cvReferences = references.filter((item) => item.show_on_cv);
  const expiryAlerts = documents.filter((item) => !item.no_expiry && isWithin90Days(item.expiry_date));

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

    const [{ data: docs }, { data: exp }, { data: refs }, { data: photos }] = await Promise.all([
      supabase.from("crew_documents").select("*").eq("crew_profile_id", profileId).order("created_at", { ascending: false }),
      supabase.from("crew_experiences").select("*").eq("crew_profile_id", profileId).order("start_date", { ascending: false }),
      supabase.from("crew_references").select("*").eq("crew_profile_id", profileId).order("created_at", { ascending: false }),
      supabase.from("crew_portfolio_photos").select("*").eq("crew_profile_id", profileId).order("created_at", { ascending: false }),
    ]);

    setDocuments((docs || []) as CrewDocument[]);
    setExperiences((exp || []) as Experience[]);
    setReferences((refs || []) as ReferenceEntry[]);
    setPortfolio((photos || []) as PortfolioPhoto[]);
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
    if (!profile.id) return;
    const response = await saveRelatedRecord("reference", item, item.id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
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

  async function uploadFile(file: File, bucket: "crew-documents" | "crew-portfolio") {
    if (!profile.id) return "";
    setUploading(bucket);
    const safeName = file.name.replaceAll(" ", "-").toLowerCase();
    const path = `${profile.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      setUploading("");
      alert(error.message === "Bucket not found" ? "File storage is not ready yet. Please create the required BlueDeck storage bucket in Supabase." : error.message);
      return "";
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setUploading("");
    return data.publicUrl;
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
          <div className="h-1.5 bg-[linear-gradient(90deg,#07111f_0%,#0891b2_34%,#d7b46a_68%,#ef776f_100%)]" />
          <div className="grid gap-0 xl:grid-cols-[1fr_420px]">
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">BlueDeck Profile</p>
              <h1 className="bd-serif mt-3 text-4xl font-normal tracking-tight text-[#071f3c] sm:text-5xl">
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[430px_1fr]">
          <aside className="space-y-6">
            <Panel title="Personal details" icon={<UserRound className="h-5 w-5" />}>
              <ProfilePhoto
                url={profile.profile_photo_url}
                name={profile.full_name}
                uploading={uploading === "crew-portfolio"}
                onUpload={async (file) => {
                  const url = await uploadFile(file, "crew-portfolio");
                  if (url) setProfile({ ...profile, profile_photo_url: url });
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

          <div className="space-y-6">
            <Panel title="Yacht experience" icon={<BriefcaseBusiness className="h-5 w-5" />}>
              <div className="space-y-4">
                {[...experiences, emptyExperience].map((item, index) => (
                  <ExperienceEditor
                    key={item.id || `new-${index}`}
                    item={item}
                    isNew={!item.id}
                    onSave={saveExperience}
                    onDelete={deleteExperience}
                    onUpload={async (file) => uploadFile(file, "crew-portfolio")}
                    uploading={uploading === "crew-portfolio"}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="References" icon={<FileText className="h-5 w-5" />}>
              <div className="space-y-4">
                {[...references, emptyReference].map((item, index) => (
                  <ReferenceEditor key={item.id || `new-${index}`} item={item} isNew={!item.id} onSave={saveReference} onDelete={deleteReference} />
                ))}
              </div>
            </Panel>

            <Panel title="Documents" icon={<IdCard className="h-5 w-5" />}>
              <DocumentCreator
                draft={documentDraft}
                setDraft={setDocumentDraft}
                onSave={saveDocument}
                onUpload={async (file) => {
                  const url = await uploadFile(file, "crew-documents");
                  if (url) setDocumentDraft({ ...documentDraft, file_url: url });
                }}
                uploading={uploading === "crew-documents"}
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
                {[...portfolio, emptyPhoto].map((item, index) => (
                  <PortfolioEditor
                    key={item.id || `new-${index}`}
                    item={item}
                    isNew={!item.id}
                    onSave={savePortfolioPhoto}
                    onDelete={deletePortfolioPhoto}
                    onUpload={async (file) => uploadFile(file, "crew-portfolio")}
                    uploading={uploading === "crew-portfolio"}
                  />
                ))}
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
  uploading,
}: {
  draft: CrewDocument;
  setDraft: (draft: CrewDocument) => void;
  onSave: () => void;
  onUpload: (file: File) => void;
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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <Upload className="h-4 w-4 text-cyan-700" />
          {uploading ? "Uploading..." : draft.file_url ? "File attached" : "Attach file/photo"}
          <input type="file" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
        </label>
        <button onClick={onSave} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#020817]">
          Add document
        </button>
      </div>
      {selectedCategory && <p className="mt-3 text-xs text-slate-500">Category: {selectedCategory}</p>}
    </div>
  );
}

function CvPreview({
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
  const cleanPortfolio = portfolio.filter((photo) => photo.image_url);
  const visibleSkills = [...(profile.personal_skills || []), ...(profile.personal_characteristics || [])].slice(0, 18);
  const completionItems = [
    Boolean(profile.full_name),
    Boolean(profile.profile_photo_url),
    Boolean(profile.bio),
    Boolean(profile.phone && profile.email),
    Boolean(profile.languages?.length),
    Boolean(documents.length),
    Boolean(cleanExperiences.length),
    Boolean(visibleSkills.length),
    Boolean(references.length),
    Boolean(cleanPortfolio.length),
  ];
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  return (
    <section
      id="bluedeck-cv"
      className="overflow-hidden rounded-[22px] border border-[#d9c9a6] bg-[#eee7da] text-[#101820] shadow-2xl shadow-slate-950/12 print:rounded-none print:border-0 print:bg-white print:shadow-none"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#d1bf99] bg-[#f6f1e7] px-5 py-4 print:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#7b6122]">BlueDeck Signature CV</p>
          <p className="mt-1 text-sm text-[#5f6b76]">Timeless maritime dossier generated from your saved crew profile.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-md bg-[#101820] px-4 py-3 text-sm font-semibold text-[#f8f4ec]">
          <Download className="h-4 w-4" />
          Save as PDF
        </button>
      </div>

      <div className="bg-[#eee7da] p-3 sm:p-5 print:p-0">
        <div className="mx-auto overflow-hidden rounded-[16px] border border-[#c7b78f] bg-[#f8f4ec] shadow-xl shadow-slate-950/10 print:rounded-none print:border-0 print:shadow-none">
          <div className="grid min-h-[1120px] lg:grid-cols-[76px_1fr] print:min-h-0 print:grid-cols-[70px_1fr]">
            <aside className="flex flex-col items-center justify-between bg-[#101820] px-3 py-7 text-[#f8f4ec]">
              <BlueDeckMark className="h-12 w-12 rounded-md border-[#d1b15f]/35 bg-[#f8f4ec]/6" imageClassName="p-1" />
              <div className="flex flex-1 items-center justify-center py-10">
                <p className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.34em] text-[#d1b15f]">
                  BlueDeck Crew Dossier
                </p>
              </div>
              <div className="border-t border-[#d1b15f]/35 pt-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Score</p>
                <p className="mt-1 text-2xl font-black text-[#d1b15f]">{completion}</p>
              </div>
            </aside>

            <div className="bg-[#f8f4ec]">
              <header className="border-b border-[#c7b78f] p-6 sm:p-8 print:p-7">
                <div className="grid gap-7 lg:grid-cols-[168px_1fr]">
                  <div>
                    <div className="h-[210px] overflow-hidden rounded-md border border-[#101820] bg-[#ece4d6] p-1">
                      {profile.profile_photo_url ? (
                        <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="h-full w-full object-cover grayscale-[12%]" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#e6dcc8] text-[#101820]/35">
                          <UserRound className="h-16 w-16" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 border-y border-[#c7b78f] py-2 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7b6122]">Crew ID</p>
                      <p className="mt-1 text-sm font-black tracking-[0.16em] text-[#101820]">{profile.public_crew_id || "-"}</p>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#7b6122]">
                            Private Maritime CV
                          </p>
                          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.02em] text-[#101820] sm:text-6xl">
                            {profile.full_name || "Crew Member"}
                          </h1>
                        </div>
                        <div className="min-w-[150px] border-l border-[#c7b78f] pl-5">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7b6122]">Position</p>
                          <p className="mt-2 text-lg font-black leading-tight text-[#101820]">{primaryPosition}</p>
                        </div>
                      </div>

                      <div className="mt-7 h-px bg-[#101820]" />
                      <div className="mt-2 h-px bg-[#d1b15f]" />

                      <p className="mt-7 max-w-4xl text-[15px] leading-7 text-[#35424d]">
                        {profile.bio ||
                          "Add a concise professional summary describing your yacht background, guest service style, safety mindset and the type of role you are targeting."}
                      </p>
                    </div>

                    <div className="mt-7 grid gap-3 sm:grid-cols-4">
                      <DossierMetric label="Experience" value={`${totalExperienceYears} years`} />
                      <DossierMetric label="Documents" value={String(documents.length)} />
                      <DossierMetric label="Languages" value={String(profile.languages?.length || 0)} />
                      <DossierMetric label="Portfolio" value={String(cleanPortfolio.length)} />
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid gap-0 xl:grid-cols-[1fr_330px] print:grid-cols-[1fr_310px]">
                <main className="p-6 sm:p-8 print:p-7">
                  <CvMainSection title="Yacht Experience">
                    <div className="space-y-4">
                      {cleanExperiences.length === 0 && (
                        <p className="border border-dashed border-[#c7b78f] bg-[#f3ede0] p-4 text-sm text-[#5f6b76]">
                          No yacht experience added yet.
                        </p>
                      )}
                      {cleanExperiences.map((item) => (
                        <div key={item.id || `${item.yacht_name}-${item.start_date}`} className="grid gap-4 border-b border-[#d8c8a6] pb-5 last:border-b-0 sm:grid-cols-[112px_1fr]">
                          {item.photo_url ? (
                            <img src={item.photo_url} alt={item.yacht_name || "Yacht"} className="h-28 w-full rounded-sm border border-[#c7b78f] object-cover grayscale-[8%]" />
                          ) : (
                            <div className="hidden h-28 border border-[#c7b78f] bg-[#eee7da] sm:block" />
                          )}
                          <div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="text-xl font-black text-[#101820]">{item.position || "Position"}</h3>
                                <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-[#255e66]">{item.yacht_name || "Yacht"}</p>
                              </div>
                              <p className="w-fit border border-[#c7b78f] bg-[#f8f4ec] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#7b6122]">
                                {formatDateRange(item.start_date, item.end_date)}
                              </p>
                            </div>
                            {item.description && <p className="mt-3 text-sm leading-6 text-[#4d5963]">{item.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CvMainSection>

                  <div className="mt-8 grid gap-8 lg:grid-cols-2">
                    <CvMainSection title="Skills & Character">
                      <PillList items={visibleSkills} light />
                    </CvMainSection>
                    <CvMainSection title="Seeking">
                      <PillList items={profile.seeking_positions || []} light />
                    </CvMainSection>
                  </div>

                  <div className="mt-8 grid gap-8 lg:grid-cols-2">
                    <CvMainSection title="Work Preferences">
                      <PillList items={profile.work_preferences || []} light />
                    </CvMainSection>
                    <CvMainSection title="References">
                      {references.length === 0 ? (
                        <p className="text-sm text-[#5f6b76]">References available upon request.</p>
                      ) : (
                        <div className="space-y-3">
                          {references.slice(0, 3).map((ref) => (
                            <div key={ref.id || ref.email || ref.name} className="border border-[#d8c8a6] bg-[#f3ede0] p-4">
                              <p className="font-black text-[#101820]">{ref.name || "Reference"}</p>
                              <p className="mt-1 text-sm font-semibold text-[#255e66]">{[ref.role, ref.vessel || ref.company].filter(Boolean).join(" / ") || "Yacht reference"}</p>
                              <p className="mt-2 text-xs text-[#66717b]">{[ref.email, ref.phone].filter(Boolean).join(" / ")}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CvMainSection>
                  </div>

                  {cleanPortfolio.length > 0 && (
                    <CvMainSection title="Portfolio">
                      <div className="grid grid-cols-3 gap-3">
                        {cleanPortfolio.slice(0, 6).map((photo) => (
                          <figure key={photo.id || photo.image_url} className="overflow-hidden border border-[#d8c8a6] bg-[#f8f4ec]">
                            <img src={photo.image_url} alt={photo.title || "Portfolio"} className="h-28 w-full object-cover grayscale-[8%]" />
                            {(photo.title || photo.location) && (
                              <figcaption className="px-3 py-2 text-xs font-semibold text-[#4d5963]">
                                {photo.title || photo.location}
                              </figcaption>
                            )}
                          </figure>
                        ))}
                      </div>
                    </CvMainSection>
                  )}
                </main>

                <aside className="border-t border-[#c7b78f] bg-[#eee7da] p-6 xl:border-l xl:border-t-0 print:border-l print:border-t-0">
                  <CvSidebarSection title="Contact">
                    <CvContact label="Email" value={profile.email || "-"} />
                    <CvContact label="Phone" value={profile.phone || "-"} />
                    <CvContact label="Nationality" value={profile.nationality || "-"} />
                    <CvContact label="Location" value={profile.location || "-"} />
                  </CvSidebarSection>

                  <CvSidebarSection title="Personal">
                    <CvContact label="DOB" value={formatCvDate(profile.date_of_birth)} />
                    <CvContact label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : "-"} />
                    <CvContact label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : "-"} />
                    <CvContact label="Smoker" value={profile.smoker || "-"} />
                    <CvContact label="Tattoos" value={profile.visible_tattoos || "-"} />
                  </CvSidebarSection>

                  <CvSidebarSection title="Languages">
                    {profile.languages?.length ? (
                      <div className="space-y-3">
                        {profile.languages.map((language) => (
                          <div key={language.name}>
                            <div className="flex justify-between gap-3 text-sm">
                              <span className="font-black text-[#101820]">{language.name}</span>
                              <span className="font-semibold text-[#255e66]">{language.level}</span>
                            </div>
                            <div className="mt-1 h-1 overflow-hidden bg-[#d8c8a6]">
                              <div className="h-full bg-[#101820]" style={{ width: languageLevelWidth(language.level) }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#5f6b76]">No languages added yet.</p>
                    )}
                  </CvSidebarSection>

                  <CvSidebarSection title="Documents">
                    <div className="space-y-2">
                      {documents.slice(0, 8).map((doc) => (
                        <CvDocumentRow key={doc.id || doc.document_type} document={doc} />
                      ))}
                      {documents.length === 0 && <p className="text-sm text-[#5f6b76]">No CV documents selected.</p>}
                    </div>
                  </CvSidebarSection>

                  <div className="mt-8 border border-[#c7b78f] bg-[#f8f4ec] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7b6122]">CV Readiness</p>
                        <p className="mt-1 text-xs text-[#5f6b76]">Profile completeness</p>
                      </div>
                      <p className="text-3xl font-black text-[#101820]">{completion}%</p>
                    </div>
                    <div className="mt-3 h-1.5 bg-[#d8c8a6]">
                      <div className="h-full bg-[#101820]" style={{ width: `${completion}%` }} />
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DossierMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#c7b78f] bg-[#f3ede0] px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7b6122]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#101820]">{value}</p>
    </div>
  );
}

function CvSidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 border-t border-[#c7b78f] pt-5 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7b6122]">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CvMainSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#c7b78f]" />
        <h2 className="text-xs font-black uppercase tracking-[0.22em] text-[#7b6122]">{title}</h2>
        <div className="h-px flex-1 bg-[#c7b78f]" />
      </div>
      {children}
    </section>
  );
}

function CvContact({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7b6122]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#101820]">{value}</p>
    </div>
  );
}

function CvDocumentRow({ document }: { document: CrewDocument }) {
  const expiring = !document.no_expiry && isWithin90Days(document.expiry_date);
  return (
    <div className={`border px-3 py-2 ${expiring ? "border-[#b7832c] bg-[#f5e8c8]" : "border-[#c7b78f] bg-[#f8f4ec]"}`}>
      <p className="text-sm font-semibold text-[#101820]">{document.document_type}</p>
      <p className={expiring ? "mt-1 text-xs text-[#8b4a18]" : "mt-1 text-xs text-[#66717b]"}>
        {document.no_expiry ? "No expiry" : formatCvDate(document.expiry_date)}
      </p>
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
  const cleanPortfolio = portfolio.filter((photo) => photo.image_url);
  const visibleSkills = [...(profile.personal_skills || []), ...(profile.personal_characteristics || [])].slice(0, 18);
  const firstName = (profile.full_name || "there").split(" ")[0];
  const age = calculateAge(profile.date_of_birth);

  return (
    <section
      id="bluedeck-cv"
      className="overflow-hidden rounded-[30px] border border-[#d6e8f1] bg-[#edf8fc] text-slate-950 shadow-2xl shadow-slate-950/10 print:rounded-none print:border-0 print:bg-white print:shadow-none"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#d6e8f1] bg-white px-5 py-4 print:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#228fc4]">BlueDeck crew CV</p>
          <p className="mt-1 text-sm text-slate-500">Seazone-style recruiter layout generated from your saved profile.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#30216f] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#30216f]/20"
        >
          <Download className="h-4 w-4" />
          Save as PDF
        </button>
      </div>

      <div className="bg-[#edf8fc] p-3 sm:p-5 print:p-0">
        <div className="mx-auto max-w-[980px] overflow-hidden rounded-[28px] border border-[#d0e4ee] bg-white shadow-2xl shadow-slate-950/12 print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="grid min-h-[1120px] lg:grid-cols-[294px_1fr] print:min-h-0 print:grid-cols-[286px_1fr]">
            <aside className="bg-[#2492c8] p-6 text-white">
              <div className="flex items-center gap-3">
                <BlueDeckMark className="h-12 w-16 rounded-2xl border-white/20 bg-white/10 shadow-black/20" imageClassName="p-1" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/80">BlueDeck</p>
                  <p className="text-xs font-semibold text-white/65">Crew profile CV</p>
                </div>
              </div>

              <div className="mt-8 text-center">
                <div className="mx-auto h-36 w-36 overflow-hidden rounded-full border-[5px] border-white bg-white shadow-xl shadow-[#166a96]/25">
                  {profile.profile_photo_url ? (
                    <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#d7f1fb] text-[#2492c8]">
                      <UserRound className="h-14 w-14" />
                    </div>
                  )}
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight">{profile.full_name || "Crew Member"}</h2>
                <p className="mt-2 text-base font-black uppercase tracking-[0.14em] text-white/78">{primaryPosition}</p>
                <p className="mt-3 inline-flex rounded-full border border-white/35 bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]">
                  {profile.public_crew_id || "Crew ID"}
                </p>
              </div>

              <div className="mt-7 divide-y divide-white/16 border-y border-white/20">
                <SeazoneInfoRow label="Age" value={age ? String(age) : "-"} />
                <SeazoneInfoRow label="Nationality" value={profile.nationality || "-"} />
                <SeazoneInfoRow label="Smoking" value={profile.smoker || "-"} />
                <SeazoneInfoRow label="Visible tattoos" value={profile.visible_tattoos || "-"} />
                <SeazoneInfoRow label="Location" value={profile.location || "-"} />
              </div>

              <div className="mt-6 grid gap-3">
                <SeazoneStat label="Experience" value={`${totalExperienceYears}y`} />
                <SeazoneStat label="References" value={String(references.length)} />
                <SeazoneStat label="Documents" value={String(documents.length)} />
              </div>

              <div className="mt-6 rounded-3xl bg-white p-4 text-slate-950 shadow-lg shadow-[#166a96]/12">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2492c8]">Contact me</p>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="break-words font-semibold">{profile.phone || "-"}</p>
                  <p className="break-words font-semibold">{profile.email || "-"}</p>
                  <p className="text-slate-500">{profile.location || "-"}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-white p-4 text-slate-950 shadow-lg shadow-[#166a96]/12">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2492c8]">Crew card</p>
                <div className="mt-4 grid grid-cols-[92px_1fr] gap-3">
                  <div className="grid h-24 grid-cols-5 gap-1 rounded-xl bg-[#f4f8fb] p-2">
                    {Array.from({ length: 25 }).map((_, index) => (
                      <span
                        key={index}
                        className={
                          [0, 1, 3, 6, 8, 10, 12, 14, 16, 20, 21, 23, 24].includes(index)
                            ? "bg-[#30216f]"
                            : "bg-white"
                        }
                      />
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Share profile</p>
                    <p className="mt-1 text-lg font-black text-[#30216f]">{profile.public_crew_id || "-"}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Use this ID for captain and recruiter lookup inside BlueDeck.</p>
                  </div>
                </div>
              </div>
            </aside>

            <main className="bg-white p-6 sm:p-8 print:p-7">
              <header className="border-b border-slate-200 pb-6">
                <p className="text-lg font-black uppercase tracking-[0.04em] text-[#2492c8]">
                  Hi, I&apos;m {firstName} :-)
                </p>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-700">
                  {profile.bio ||
                    `I am a ${primaryPosition.toLowerCase()} looking for a professional yacht opportunity. I am reliable, guest-focused and ready to contribute to a well-run crew.`}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <SeazoneMiniCard label="Looking for" value={(profile.seeking_positions || [primaryPosition])[0] || primaryPosition} />
                  <SeazoneMiniCard label="Available for" value={(profile.work_preferences || ["Yacht position"])[0] || "Yacht position"} />
                  <SeazoneMiniCard label="Documents" value={`${documents.length} on CV`} />
                </div>
              </header>

              <SeazoneSection title="Yacht Experience" badge={`${totalExperienceYears} years`}>
                <div className="space-y-4">
                  {cleanExperiences.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                      No yacht experience added yet.
                    </p>
                  )}
                  {cleanExperiences.map((item, index) => (
                    <SeazoneExperienceCard
                      key={item.id || `${item.yacht_name}-${item.start_date}`}
                      experience={item}
                      reference={references[index] || references[0]}
                    />
                  ))}
                </div>
              </SeazoneSection>

              <div className="mt-7 grid gap-5 xl:grid-cols-2">
                <SeazoneSection title="Certificates & Documents">
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-sm text-slate-500">No CV documents selected.</p>}
                    {documents.slice(0, 8).map((doc) => (
                      <SeazoneDocumentRow key={doc.id || doc.document_type} document={doc} />
                    ))}
                  </div>
                </SeazoneSection>

                <SeazoneSection title="Languages">
                  <div className="space-y-3">
                    {profile.languages?.length ? (
                      profile.languages.map((language) => (
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
                </SeazoneSection>
              </div>

              <div className="mt-7 grid gap-5 xl:grid-cols-2">
                <SeazoneSection title="Skills">
                  <PillList items={visibleSkills} light />
                </SeazoneSection>
                <SeazoneSection title="Work Preferences">
                  <PillList items={profile.work_preferences || []} light />
                </SeazoneSection>
              </div>

              {references.length > 0 && (
                <SeazoneSection title="References">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {references.slice(0, 4).map((ref) => (
                      <div key={ref.id || ref.email || ref.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-black text-slate-900">{ref.name || "Reference"}</p>
                        <p className="mt-1 text-sm font-semibold text-[#2492c8]">{[ref.role, ref.vessel || ref.company].filter(Boolean).join(" / ") || "Yacht reference"}</p>
                        <p className="mt-2 text-xs text-slate-500">{[ref.email, ref.phone].filter(Boolean).join(" / ")}</p>
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
    </section>
  );
}

function SeazoneStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 text-slate-950 shadow-lg shadow-[#166a96]/10">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2492c8]">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function SeazoneInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-sm">
      <p className="font-semibold text-white/70">{label}</p>
      <p className="text-right font-black text-white">{value}</p>
    </div>
  );
}

function SeazoneMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function SeazoneSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#30216f]">{title}</h3>
        {badge && <span className="rounded-full bg-[#2492c8] px-3 py-1 text-xs font-black text-white">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function SeazoneExperienceCard({ experience, reference }: { experience: Experience; reference?: ReferenceEntry }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5">
      <div className="grid gap-4 sm:grid-cols-[112px_1fr]">
        {experience.photo_url ? (
          <img src={experience.photo_url} alt={experience.yacht_name || "Yacht"} className="h-24 w-full rounded-xl object-cover" />
        ) : (
          <div className="hidden h-24 rounded-xl bg-[linear-gradient(135deg,#e8f6fb,#f5f1ff)] sm:block" />
        )}
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-lg font-black text-slate-950">{experience.yacht_name || "Yacht"}</h4>
              <p className="mt-1 text-sm font-semibold text-[#2492c8]">{formatDateRange(experience.start_date, experience.end_date)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-[#2492c8] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-white">
                {experience.position || "Position"}
              </span>
              {reference?.name && (
                <span className="rounded-md bg-[#eefaf2] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-emerald-700">
                  Reference
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#30216f]">Duties</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {experience.description || "Responsibilities and onboard duties will appear here."}
            </p>
          </div>

          {reference?.name && (
            <p className="mt-3 text-xs text-slate-500">
              Reference: {reference.name}{reference.role ? ` / ${reference.role}` : ""}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function SeazoneDocumentRow({ document }: { document: CrewDocument }) {
  const expiring = !document.no_expiry && isWithin90Days(document.expiry_date);
  return (
    <div className={`rounded-xl border px-4 py-3 ${expiring ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{document.document_type}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{document.category || "Certificate"}</p>
        </div>
        <p className={expiring ? "text-xs font-black text-amber-700" : "text-xs font-black text-[#2492c8]"}>
          {document.no_expiry ? "No expiry" : formatCvDate(document.expiry_date)}
        </p>
      </div>
    </div>
  );
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

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="h-1 bg-[linear-gradient(90deg,#07111f,#0891b2,#d7b46a,#ef776f)]" />
      <div className="p-5">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0e7490,#67e8f9)] text-white shadow-lg shadow-cyan-900/15">{icon}</div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}

function ProfilePhoto({ url, name, uploading, onUpload }: { url?: string; name?: string; uploading: boolean; onUpload: (file: File) => void }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-100">
        {url ? <img src={url} alt={name || "Profile"} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-400"><UserRound className="h-10 w-10" /></div>}
      </div>
      <div>
        <p className="font-semibold text-slate-950">Profile photo</p>
        <p className="mt-1 text-sm text-slate-500">This appears in your portal and CV.</p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload photo"}
          <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
        </label>
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
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-700">
              Language profile
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Add each language once, then set the level that should appear on
              your BlueDeck CV.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
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
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                CV language
              </p>
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

function ExperienceEditor({ item, isNew, onSave, onDelete, onUpload, uploading }: { item: Experience; isNew: boolean; onSave: (item: Experience) => void; onDelete: (id?: string) => void; onUpload: (file: File) => Promise<string>; uploading: boolean }) {
  const [draft, setDraft] = useState(item);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {draft.photo_url && <img src={draft.photo_url} alt={draft.yacht_name || "Yacht"} className="mb-4 h-52 w-full rounded-xl object-cover" />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Yacht name" value={draft.yacht_name} onChange={(value) => setDraft({ ...draft, yacht_name: value })} />
        <Field label="Position" value={draft.position} onChange={(value) => setDraft({ ...draft, position: value })} />
        <DateField label="Start date" value={draft.start_date} onChange={(value) => setDraft({ ...draft, start_date: value })} />
        <DateField label="End date" value={draft.end_date} onChange={(value) => setDraft({ ...draft, end_date: value })} />
      </div>
      <TextArea label="Duties" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-slate-700">
        <Upload className="h-4 w-4 text-cyan-700" />
        {uploading ? "Uploading..." : draft.photo_url ? "Change yacht photo" : "Add yacht photo"}
        <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const url = await onUpload(file);
          if (url) setDraft({ ...draft, photo_url: url });
        }} />
      </label>
      <EditorButtons isNew={isNew} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Add experience" />
    </div>
  );
}

function ReferenceEditor({ item, isNew, onSave, onDelete }: { item: ReferenceEntry; isNew: boolean; onSave: (item: ReferenceEntry) => void; onDelete: (id?: string) => void }) {
  const [draft, setDraft] = useState(item);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <Field label="Role" value={draft.role} onChange={(value) => setDraft({ ...draft, role: value })} />
        <Field label="Vessel" value={draft.vessel} onChange={(value) => setDraft({ ...draft, vessel: value })} />
        <Field label="Company" value={draft.company} onChange={(value) => setDraft({ ...draft, company: value })} />
        <PhoneInput label="Phone" value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} />
        <Field label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
      </div>
      <TextArea label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
      <Checkbox label="Show on CV" checked={draft.show_on_cv} onChange={(checked) => setDraft({ ...draft, show_on_cv: checked })} />
      <EditorButtons isNew={isNew} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Add reference" />
    </div>
  );
}

function PortfolioEditor({ item, isNew, onSave, onDelete, onUpload, uploading }: { item: PortfolioPhoto; isNew: boolean; onSave: (item: PortfolioPhoto) => void; onDelete: (id?: string) => void; onUpload: (file: File) => Promise<string>; uploading: boolean }) {
  const [draft, setDraft] = useState(item);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {draft.image_url && <img src={draft.image_url} alt={draft.title || "Portfolio"} className="mb-4 h-44 w-full rounded-xl object-cover" />}
      <Field label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
      <Field label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} />
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-slate-700">
        <Upload className="h-4 w-4 text-cyan-700" />
        {uploading ? "Uploading..." : draft.image_url ? "Change photo" : "Add photo"}
        <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const url = await onUpload(file);
          if (url) setDraft({ ...draft, image_url: url });
        }} />
      </label>
      <EditorButtons isNew={isNew} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Save photo" />
    </div>
  );
}

function EditorButtons({ isNew, onSave, onDelete, addLabel }: { isNew: boolean; onSave: () => void; onDelete: () => void; addLabel: string }) {
  return (
    <div className="mt-4 flex gap-2">
      <button onClick={onSave} className="flex items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#020817]">
        <Plus className="h-4 w-4" />
        {isNew ? addLabel : "Save"}
      </button>
      {!isNew && <button onClick={onDelete} className="rounded-lg border border-red-300/20 px-3 py-2 text-sm font-semibold text-red-200">Delete</button>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }: { label: string; value?: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <input type={type} value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:opacity-40" />
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
