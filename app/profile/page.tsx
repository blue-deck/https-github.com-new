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
  Home,
  IdCard,
  Languages,
  MapPin,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { PhoneInput } from "../components/PhoneInput";
import { blueDeckCountries, nationalityOptions } from "../lib/countries";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { supabase } from "../lib/supabase";

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

const yachtPositions = [
  "Captain",
  "Relief Captain",
  "Chief Officer",
  "First Mate",
  "Bosun",
  "Deckhand",
  "Chief Engineer",
  "Engineer",
  "ETO",
  "Chief Steward/ess",
  "Stewardess",
  "Chef",
  "Sous Chef",
  "Purser",
  "Deck/Stew",
  "Cook/Stew",
  "Delivery Crew",
  "Tender Driver",
];

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
  "Russian",
  "French",
  "Italian",
  "Spanish",
  "German",
  "Greek",
  "Arabic",
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
      supabase.from("profiles").upsert({
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

    const { error } = await supabase.from("crew_documents").insert({
      ...documentDraft,
      crew_profile_id: profile.id,
      expiry_date: documentDraft.no_expiry ? null : documentDraft.expiry_date || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setDocumentDraft(newDocumentDraft());
    await loadRelated(profile.id);
  }

  async function updateDocument(document: CrewDocument) {
    if (!profile.id || !document.id) return;
    const { error } = await supabase.from("crew_documents").update(document).eq("id", document.id);
    if (error) alert(error.message);
    await loadRelated(profile.id);
  }

  async function deleteDocument(id?: string) {
    if (!profile.id || !id) return;
    await supabase.from("crew_documents").delete().eq("id", id);
    await loadRelated(profile.id);
  }

  async function saveExperience(item: Experience) {
    if (!profile.id) return;
    const payload = { ...item, crew_profile_id: profile.id };
    const { error } = item.id
      ? await supabase.from("crew_experiences").update(payload).eq("id", item.id)
      : await supabase.from("crew_experiences").insert(payload);
    if (error) alert(error.message);
    await loadRelated(profile.id);
  }

  async function deleteExperience(id?: string) {
    if (!profile.id || !id) return;
    await supabase.from("crew_experiences").delete().eq("id", id);
    await loadRelated(profile.id);
  }

  async function saveReference(item: ReferenceEntry) {
    if (!profile.id) return;
    const payload = { ...item, crew_profile_id: profile.id };
    const { error } = item.id
      ? await supabase.from("crew_references").update(payload).eq("id", item.id)
      : await supabase.from("crew_references").insert(payload);
    if (error) alert(error.message);
    await loadRelated(profile.id);
  }

  async function deleteReference(id?: string) {
    if (!profile.id || !id) return;
    await supabase.from("crew_references").delete().eq("id", id);
    await loadRelated(profile.id);
  }

  async function savePortfolioPhoto(item: PortfolioPhoto) {
    if (!profile.id) return;
    const payload = { ...item, crew_profile_id: profile.id };
    const { error } = item.id
      ? await supabase.from("crew_portfolio_photos").update(payload).eq("id", item.id)
      : await supabase.from("crew_portfolio_photos").insert(payload);
    if (error) alert(error.message);
    await loadRelated(profile.id);
  }

  async function deletePortfolioPhoto(id?: string) {
    if (!profile.id || !id) return;
    await supabase.from("crew_portfolio_photos").delete().eq("id", id);
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
      alert(error.message === "Bucket not found" ? "Photo storage is not ready yet. Please run the Supabase storage SQL I sent you." : error.message);
      return "";
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setUploading("");
    return data.publicUrl;
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return <main className="min-h-screen bg-[#f4f0e8] p-8 text-slate-900">Loading profile...</main>;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fbf7ef_0%,#e8fbff_38%,#fff4dc_76%,#f9fafb_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1520px]">
        <header className="overflow-hidden rounded-2xl border border-cyan-200/80 bg-white/85 shadow-2xl shadow-slate-900/10 backdrop-blur">
          <div className="h-1.5 bg-[linear-gradient(90deg,#07111f_0%,#0891b2_34%,#d7b46a_68%,#ef776f_100%)]" />
          <div className="grid gap-0 xl:grid-cols-[1fr_420px]">
            <div className="p-6 sm:p-8">
              <div className="mb-5 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  <Home className="h-4 w-4 text-cyan-700" />
                  My Dashboard
                </Link>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">BlueDeck Profile</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
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
          <section className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-50 p-4 text-amber-950">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
              <div>
                <h2 className="font-semibold text-amber-100">Documents expiring within 3 months</h2>
                <p className="mt-1 text-sm text-amber-100/75">
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
              <DropdownChoiceGroup title="Position" options={yachtPositions} value={profile.current_positions || []} onChange={(value) => setProfile({ ...profile, current_positions: value, current_position: value[0] || "" })} />
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
              <DropdownChoiceGroup title="Seeking positions" options={yachtPositions} value={profile.seeking_positions || []} onChange={(value) => setProfile({ ...profile, seeking_positions: value })} />
            </Panel>

            <CvPreview
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
  return (
    <section id="bluedeck-cv" className="overflow-hidden rounded-2xl border border-white/70 bg-white text-slate-950 shadow-2xl shadow-slate-900/10 print:border-0 print:shadow-none">
      <div className="relative bg-[linear-gradient(135deg,#07111f_0%,#0f766e_56%,#d7b46a_100%)] p-7 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.24),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(34,211,238,0.2),transparent_26%)]" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="flex gap-5">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/30 bg-white/15 shadow-xl">
              {profile.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/70">
                  <UserRound className="h-10 w-10" />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">BlueDeck CV</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">{profile.full_name || "Crew Member"}</h2>
              <p className="mt-2 text-base text-white/80">{profile.current_positions?.[0] || profile.current_position || "Yacht Crew"} · Crew ID {profile.public_crew_id}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm text-white/85 md:text-right">
            <p>{profile.email || "-"}</p>
            <p>{profile.phone || "-"}</p>
            <p>{profile.nationality || "-"}</p>
            <p>{profile.location || "-"}</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-b border-slate-200 bg-[#fbfaf7] p-4 print:hidden">
        <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
          <Download className="h-4 w-4" />
          Save as PDF
        </button>
      </div>
      <div className="grid gap-3 bg-[#fbfaf7] p-5 sm:grid-cols-4">
        <CvStat label="Experience" value={`${totalExperienceYears} years`} />
        <CvStat label="Documents" value={String(documents.length)} />
        <CvStat label="Languages" value={String(profile.languages?.length || 0)} />
        <CvStat label="Portfolio" value={String(portfolio.length)} />
      </div>
      <div className="grid gap-8 p-6 md:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-5 rounded-2xl bg-slate-950 p-5 text-white">
          <CvBlock title="Personal">
            <p>DOB: {profile.date_of_birth || "-"}</p>
            <p>Height/Weight: {profile.height_cm || "-"} cm / {profile.weight_kg || "-"} kg</p>
            <p>Smoker: {profile.smoker || "-"}</p>
            <p>Tattoos: {profile.visible_tattoos || "-"}</p>
          </CvBlock>
          <CvBlock title="Languages">
            {(profile.languages || []).map((lang) => <p key={lang.name}>{lang.name}: {lang.level}</p>)}
          </CvBlock>
          <CvBlock title="Documents">
            {documents.length === 0 && <p>No CV documents selected.</p>}
            {documents.map((doc) => (
              <p key={doc.id}>{doc.document_type}: {doc.no_expiry ? "No expiry" : doc.expiry_date || "-"}</p>
            ))}
          </CvBlock>
          <CvBlock title="Preferences">
            <PillList items={profile.work_preferences || []} />
          </CvBlock>
        </div>
        <div className="space-y-5">
          <CvBlock title="Profile">
            <p>{profile.bio || "Add a concise professional summary."}</p>
          </CvBlock>
          <CvBlock title="Yacht Experience">
            {experiences.length === 0 && <p>No yacht experience added yet.</p>}
            {experiences.map((item) => (
              <div key={item.id} className="mb-4 grid gap-3 border-b border-slate-200 pb-4 last:border-0 sm:grid-cols-[110px_1fr]">
                {item.photo_url ? <img src={item.photo_url} alt={item.yacht_name} className="h-24 w-full rounded-xl object-cover" /> : <div className="hidden h-24 rounded-xl bg-slate-100 sm:block" />}
                <div>
                  <p className="font-semibold">{item.position || "Position"} · {item.yacht_name || "Yacht"}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.start_date || "-"} to {item.end_date || "Present"}</p>
                  {item.description && <p className="mt-2">{item.description}</p>}
                </div>
              </div>
            ))}
          </CvBlock>
          <CvBlock title="References">
            {references.length === 0 && <p>References available upon request.</p>}
            {references.map((ref) => <p key={ref.id}>{ref.name} · {ref.role} · {ref.vessel || ref.company}</p>)}
          </CvBlock>
          <CvBlock title="Skills">
            <PillList items={[...(profile.personal_skills || []), ...(profile.personal_characteristics || [])].slice(0, 18)} light />
          </CvBlock>
          <CvBlock title="Seeking">
            <PillList items={profile.seeking_positions || []} light />
          </CvBlock>
          {portfolio.length > 0 && (
            <CvBlock title="Portfolio">
              <div className="grid grid-cols-3 gap-2">
                {portfolio.slice(0, 6).map((photo) => (
                  <img key={photo.id || photo.image_url} src={photo.image_url} alt={photo.title || "Portfolio"} className="h-24 w-full rounded-xl object-cover" />
                ))}
              </div>
            </CvBlock>
          )}
        </div>
      </div>
    </section>
  );
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

function ChoiceGroup({ title, options, value, onChange }: { title: string; options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              onClick={() => onChange(selected ? value.filter((item) => item !== option) : [...value, option])}
              className={`rounded-full border px-3 py-2 text-sm transition ${selected ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-400"}`}
            >
              {option}
            </button>
          );
        })}
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
  function setLanguage(name: string, level: string) {
    const rest = value.filter((item) => item.name !== name);
    onChange(level ? [...rest, { name, level }] : rest);
  }

  return (
    <div className="space-y-3">
      {languageOptions.map((language) => (
        <div key={language} className="grid grid-cols-[1fr_150px] items-center gap-3">
          <span className="text-sm text-slate-700">{language}</span>
          <select
            value={value.find((item) => item.name === language)?.level || ""}
            onChange={(event) => setLanguage(language, event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-cyan-500"
          >
            <option value="">Not listed</option>
            {languageLevels.map((level) => <option key={level}>{level}</option>)}
          </select>
        </div>
      ))}
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

function CvStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-950">{value}</p></div>;
}

function CvBlock({ title, children }: { title: string; children: ReactNode }) {
  return <div><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-600">{title}</h3><div className="text-sm leading-6 text-current opacity-85">{children}</div></div>;
}

function PillList({ items, light = false }: { items: string[]; light?: boolean }) {
  if (items.length === 0) return <p className={light ? "text-slate-500" : "text-slate-500"}>-</p>;
  return <div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className={`rounded-full px-2.5 py-1 text-xs ${light ? "bg-slate-100 text-slate-700" : "bg-cyan-400/10 text-cyan-200"}`}>{item}</span>)}</div>;
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
