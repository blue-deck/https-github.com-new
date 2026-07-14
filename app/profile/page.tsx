"use client";

import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  IdCard,
  Languages,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { toDataURL } from "qrcode";
import { BlueDeckMark } from "../components/BlueDeckLogo";
import { CvScaleFrame } from "../components/CvScaleFrame";
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
  gender?: string;
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
  created_at?: string;
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
  yacht_type?: string;
  yacht_program?: string;
  yacht_size?: string;
  location?: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
  photo_url: string;
};

type PortfolioPhoto = {
  id?: string;
  created_at?: string;
  title: string;
  image_url: string;
  location: string;
  gallery_order?: number;
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
type CvStudioTab = "personal" | "experience" | "otherWork" | "skills" | "documents" | "languages" | "preview";

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
const professionalSummaryMaxLength = 250;
const yachtDutiesMaxLength = 200;

const yachtTypeOptions = [
  "Motor yacht",
  "Sailing yacht",
  "Catamaran",
  "Motor catamaran",
  "Gulet",
  "Expedition yacht",
  "Classic yacht",
  "Support vessel",
  "Chase boat",
  "Commercial vessel",
];

const yachtProgramOptions = [
  "Private",
  "Charter",
  "Private / Charter",
  "New build",
  "Refit",
  "Delivery",
  "Yard period",
  "Race / Regatta",
];

const documentCatalog = [
  {
    category: "Identity & Travel",
    items: [
      "Passport",
      "National ID",
      "Seaman's Book",
      "Seafarer Discharge Book",
      "Discharge Certificate",
      "Certificate of Equivalent Competency",
      "Schengen Visa",
      "US B1/B2 Visa",
      "UK Visa",
      "Australian Maritime Crew Visa",
      "Australian Maritime Crew Visa 988",
      "Residence Permit",
      "Work Permit",
      "Vaccination Record",
      "Yellow Fever Certificate",
    ],
  },
  {
    category: "STCW & Safety",
    items: [
      "STCW Basic Safety Training",
      "STCW Elementary First Aid",
      "STCW Personal Survival Techniques",
      "STCW Fire Prevention and Fire Fighting",
      "STCW Personal Safety and Social Responsibility",
      "STCW Security Awareness",
      "Designated Security Duties",
      "Proficiency in Survival Craft",
      "Advanced Fire Fighting",
      "Medical First Aid",
      "Medical Care On Board",
      "PDSD",
      "Crowd Management",
      "Crisis Management",
      "Passenger Ship Safety",
      "Ship Security Officer",
      "Helicopter Underwater Escape Training",
      "MCA Security Awareness",
      "MCA Designated Security Duties",
    ],
  },
  {
    category: "Deck & Captain",
    items: [
      "Certificate of Competency",
      "MCA Master 200GT",
      "MCA Master 500GT",
      "MCA Master 3000GT",
      "MCA OOW Yachts",
      "MCA Chief Mate Yachts",
      "RYA Day Skipper",
      "RYA Coastal Skipper",
      "RYA Yachtmaster Coastal",
      "RYA Yachtmaster Offshore",
      "RYA Yachtmaster Ocean",
      "RYA/MCA Yachtmaster Coastal Commercial Endorsement",
      "RYA/MCA Yachtmaster Offshore Commercial Endorsement",
      "RYA/MCA Yachtmaster Ocean Commercial Endorsement",
      "IYT International Bareboat Skipper",
      "IYT Master of Yachts Coastal",
      "IYT Master of Yachts Limited",
      "IYT Master of Yachts Unlimited",
      "IYT Superyacht Deck Crew",
      "AMSA Master <24m",
      "AMSA Master <35m",
      "AMSA Master <45m",
      "AMSA Mate <80m",
      "Master 200GT",
      "Master 500GT",
      "Master 3000GT",
      "OOW",
      "OOW Yachts",
      "Chief Mate Yachts",
      "GMDSS GOC",
      "GMDSS ROC",
      "Radar / ARPA",
      "ECDIS",
      "Electronic Navigation Systems",
      "Efficient Deckhand",
      "Bridge Resource Management",
      "MCA HELM Operational",
      "MCA HELM Management",
      "Celestial Navigation",
      "Ocean Passage Making",
      "Boatmaster Licence",
    ],
  },
  {
    category: "Powerboat, RIB & PWC",
    items: [
      "RYA Powerboat Level 2",
      "RYA Intermediate Powerboat",
      "RYA Advanced Powerboat",
      "RYA Tender Operator",
      "RYA Personal Watercraft",
      "RYA PWC Proficiency",
      "RYA PWC Instructor",
      "IYT Small Powerboat & RIB Master",
      "IYT Rib Master",
      "IYT Tender Operator",
      "IYT Personal Watercraft Operator",
      "Jet Ski Licence",
      "PWC / Jet Ski Instructor",
      "VHF Short Range Certificate",
    ],
  },
  {
    category: "Engineering",
    items: [
      "AEC 1",
      "AEC 2",
      "Approved Engine Course",
      "MEOL",
      "MCA Marine Engine Operator Licence",
      "Small Vessel Second Engineer",
      "Small Vessel Chief Engineer",
      "MCA SV Second Engineer",
      "MCA SV Chief Engineer",
      "AMSA Marine Engine Driver Grade 3",
      "AMSA Marine Engine Driver Grade 2",
      "AMSA Marine Engine Driver Grade 1",
      "AMSA Engineer Class 3",
      "Y4 Engineer",
      "Y3 Engineer",
      "Y2 Engineer",
      "Y1 Engineer",
      "High Voltage Operational",
      "High Voltage Management",
      "Refrigeration",
      "Hydraulics",
      "Watermaker Training",
      "Engine Manufacturer Training",
    ],
  },
  {
    category: "Interior & Galley",
    items: [
      "Food Hygiene Level 2",
      "Food Hygiene Level 3",
      "Food Safety Level 2",
      "Food Safety Level 3",
      "HACCP",
      "Allergen Awareness",
      "Ship's Cook Certificate",
      "Chef Diploma",
      "Culinary Arts Certificate",
      "Galley Management",
      "Wine Service",
      "WSET Level 1",
      "WSET Level 2",
      "Silver Service",
      "Barista",
      "Mixology",
      "Housekeeping",
      "Laundry",
      "Floristry",
      "Spa / Massage Certificate",
    ],
  },
  {
    category: "Medical",
    items: [
      "ENG1 Medical",
      "ML5 Medical",
      "Medical Fitness Certificate",
      "Seafarer Medical Certificate",
      "COVID Vaccination",
    ],
  },
  {
    category: "Driving",
    items: [
      "Driving License",
      "International Driving Permit",
      "Commercial Driver Licence",
    ],
  },
  {
    category: "Diving",
    items: [
      "Diving Certificate",
      "PADI Open Water",
      "PADI Advanced Open Water",
      "PADI Rescue Diver",
      "PADI Divemaster",
      "PADI Instructor",
      "SSI Open Water",
      "SSI Advanced Adventurer",
      "SSI Diving Certificate",
    ],
  },
];

const emptyExperience: Experience = {
  yacht_name: "",
  yacht_type: "",
  yacht_program: "",
  yacht_size: "",
  location: "",
  position: "",
  start_date: "",
  end_date: "",
  description: "",
  photo_url: "",
};

const otherWorkExperienceMarker = "__BLUDECK_OTHER_WORK__";
const referenceUponRequestText = "References available upon request.";
const referenceUponRequestCvText = "REFERENCES AVAILABLE UPON REQUEST";
const referenceUponRequestMarker = "__BLUDECK_REFERENCE_ON_REQUEST__";
const maxCvDocuments = 15;
const profileFieldLabelClassName = "mb-1.5 block select-text text-xs font-semibold leading-4 text-slate-700";
const profileFieldControlClassName = "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 sm:text-sm";

const emptyOtherWorkExperience: Experience = {
  ...emptyExperience,
  yacht_type: otherWorkExperienceMarker,
  yacht_program: "Other work",
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<CrewProfile>({});
  const [documents, setDocuments] = useState<CrewDocument[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [references, setReferences] = useState<ReferenceEntry[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);
  const [documentDraft, setDocumentDraft] = useState<CrewDocument>(newDocumentDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedProfile, setSavedProfile] = useState<CrewProfile>({});
  const [referenceSaving, setReferenceSaving] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [activeStudioTab, setActiveStudioTab] = useState<CvStudioTab>("personal");
  const [openSkillsGroup, setOpenSkillsGroup] = useState<string | null>(null);
  const [newDocumentOpen, setNewDocumentOpen] = useState(true);
  const [newYachtExperienceOpen, setNewYachtExperienceOpen] = useState(true);
  const [newYachtExperienceDirty, setNewYachtExperienceDirty] = useState(false);
  const [newOtherWorkExperienceOpen, setNewOtherWorkExperienceOpen] = useState(true);
  const [newOtherWorkExperienceDirty, setNewOtherWorkExperienceDirty] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const newDocumentFormId = useId();
  const newYachtExperienceFormId = useId();
  const newOtherWorkExperienceFormId = useId();
  const uploadRunRef = useRef(0);

  const sortedDocuments = useMemo(() => sortCrewDocuments(documents), [documents]);
  const cvDocuments = sortedDocuments.filter((item) => item.show_on_cv).slice(0, maxCvDocuments);
  const cvReferences = references.filter((item) => item.show_on_cv);
  const expiryAlerts = documents.filter((item) => !item.no_expiry && isWithin90Days(item.expiry_date));
  const profileDirty = !saveStateEquals(profileSaveState(profile), profileSaveState(savedProfile));
  const currentPositionValue = getProfileCurrentPosition(profile);
  const skillsCount = (profile.personal_skills?.length || 0) + (profile.personal_characteristics?.length || 0) + (profile.work_preferences?.length || 0);
  const sortedExperiences = useMemo(
    () =>
      [...experiences].sort((first, second) => {
        const firstCreatedAt = first.created_at ? Date.parse(first.created_at) : 0;
        const secondCreatedAt = second.created_at ? Date.parse(second.created_at) : 0;
        return secondCreatedAt - firstCreatedAt;
      }),
    [experiences],
  );
  const editableYachtExperiences = useMemo(
    () => sortedExperiences.filter((item) => !isOtherWorkExperience(item)),
    [sortedExperiences],
  );
  const editableOtherWorkExperiences = useMemo(
    () => sortedExperiences.filter(isOtherWorkExperience),
    [sortedExperiences],
  );
  const showNewYachtExperienceForm = newYachtExperienceOpen;
  const showNewOtherWorkExperienceForm = newOtherWorkExperienceOpen;
  const showNewDocumentForm = newDocumentOpen;
  const newDocumentDirty = !saveStateEquals(documentSaveState(documentDraft), documentSaveState(newDocumentDraft()));
  const totalExperienceYears = useMemo(() => {
    const firstYear = editableYachtExperiences
      .map((item) => Number((item.start_date || "").slice(0, 4)))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    return firstYear ? `${Math.max(new Date().getFullYear() - firstYear, 1)}+` : "0";
  }, [editableYachtExperiences]);
  const cvCompletionPercent = useMemo(
    () =>
      calculateCvCompletion({
        profile,
        documents: cvDocuments,
        yachtExperiences: editableYachtExperiences,
        otherWorkExperiences: editableOtherWorkExperiences,
        references: cvReferences,
        portfolio,
      }),
    [profile, cvDocuments, editableYachtExperiences, editableOtherWorkExperiences, cvReferences, portfolio],
  );
  const studioTabs: Array<{
    id: CvStudioTab;
    label: string;
    description: string;
    status: string;
    icon: ReactNode;
  }> = [
    {
      id: "personal",
      label: "Personal Details",
      description: "Identity, contact, photo and summary.",
      status: profileDirty ? "Unsaved" : "Saved",
      icon: <UserRound className="h-4 w-4" />,
    },
    {
      id: "experience",
      label: "Yacht Experience",
      description: "Yachts, duties, photos and references.",
      status: `${editableYachtExperiences.length} saved`,
      icon: <BriefcaseBusiness className="h-4 w-4" />,
    },
    {
      id: "otherWork",
      label: "Other Work Experience",
      description: "Non-yacht work history, duties and references.",
      status: `${editableOtherWorkExperiences.length} saved`,
      icon: <BriefcaseBusiness className="h-4 w-4" />,
    },
    {
      id: "skills",
      label: "Skills & Characteristics",
      description: "Skills, traits, preferences and seeking roles.",
      status: `${skillsCount} selected`,
      icon: <Star className="h-4 w-4" />,
    },
    {
      id: "documents",
      label: "Documents & Certificates",
      description: "Certificates and CV visibility.",
      status: expiryAlerts.length ? `${expiryAlerts.length} alert` : `${documents.length} docs`,
      icon: <IdCard className="h-4 w-4" />,
    },
    {
      id: "languages",
      label: "Languages",
      description: "Language level profile.",
      status: `${profile.languages?.length || 0} added`,
      icon: <Languages className="h-4 w-4" />,
    },
    {
      id: "preview",
      label: "Preview / Download",
      description: "Review the final CV and download PDF.",
      status: "PDF ready",
      icon: <Download className="h-4 w-4" />,
    },
  ];
  const activeStudioTabInfo = studioTabs.find((tab) => tab.id === activeStudioTab) || studioTabs[0];

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
      const normalizedProfile = normalizeProfile({
        ...existingProfile,
        email: existingProfile.email || user.email || "",
        gender: existingProfile.gender || user.user_metadata?.gender || "",
      });
      setProfile(normalizedProfile);
      setSavedProfile(normalizedProfile);
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

    const normalizedProfile = normalizeProfile({
      ...(data || newProfile),
      gender: user.user_metadata?.gender || "",
    });
    setProfile(normalizedProfile);
    setSavedProfile(normalizedProfile);
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

    setDocuments(sortCrewDocuments(result.documents || []));
    setExperiences((result.experiences || []).map(normalizeExperienceRecord));
    setReferences(result.references || []);
    setPortfolio(sortPortfolioPhotos((result.portfolio || []).map(normalizePortfolioRecord)));
  }

  async function saveProfile(nextProfile: CrewProfile = profile) {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setSaving(false);
      window.location.href = "/login";
      return false;
    }

    const normalizedForSave = normalizeProfile(nextProfile);
    const profilePayload: Record<string, unknown> = {
      ...normalizedForSave,
      email: normalizedForSave.email || user.email,
      public_crew_id: normalizedForSave.public_crew_id || user.id.slice(0, 8).toUpperCase(),
    };
    delete profilePayload.id;

    let { data, error } = await saveCrewProfileByUserId<CrewProfile>(
      supabase,
      user.id,
      profilePayload
    );

    if (error && /gender/i.test(error.message) && /column|schema|field/i.test(error.message)) {
      delete profilePayload.gender;
      const retry = await saveCrewProfileByUserId<CrewProfile>(
        supabase,
        user.id,
        profilePayload
      );
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      setSaving(false);
      alert(error.message);
      return false;
    }

    await Promise.all([
      saveBaseProfileById(supabase, {
        id: user.id,
        email: user.email || "",
        full_name: normalizedForSave.full_name || user.email,
        phone: normalizedForSave.phone || "",
        role: inferBaseRoleFromPosition(normalizedForSave.current_position),
      }),
      supabase.auth.updateUser({
        data: {
          full_name: normalizedForSave.full_name || user.email,
          phone: normalizedForSave.phone || "",
          gender: normalizedForSave.gender || "",
        },
      }),
    ]);

    const normalizedProfile = normalizeProfile({
      ...normalizedForSave,
      ...(data || {}),
      user_id: user.id,
    });
    setProfile(normalizedProfile);
    setSavedProfile(normalizedProfile);
    setSaving(false);
    return true;
  }

  async function saveDocument(nextDraft: CrewDocument = documentDraft) {
    if (documents.length >= maxCvDocuments) {
      alert(`You can add up to ${maxCvDocuments} documents and certificates to your BlueDeck CV.`);
      return false;
    }

    const hasDocumentDetail = [
      nextDraft.document_type,
      nextDraft.category,
      nextDraft.expiry_date,
      nextDraft.file_url,
      nextDraft.notes,
    ].some((value) => typeof value === "string" && value.trim().length > 0);

    if (!profile.id || !hasDocumentDetail) {
      alert("Add a document type or expiry date before saving.");
      return false;
    }

    const documentType = cleanSaveText(nextDraft.document_type) || "Document";
    const category = cleanSaveText(nextDraft.category) || "General";
    const response = await saveRelatedRecord("document", documentPayloadForSave({
      ...nextDraft,
      document_type: documentType,
      category,
    }));

    if (!response.ok) {
      alert(response.error);
      return false;
    }

    setDocumentDraft(newDocumentDraft());
    await loadRelated(profile.id);
    return true;
  }

  async function updateDocument(document: CrewDocument) {
    if (!profile.id || !document.id) return false;
    const response = await saveRelatedRecord("document", documentPayloadForSave(document), document.id);
    if (!response.ok) {
      alert(response.error);
      return false;
    }
    await loadRelated(profile.id);
    return true;
  }

  async function deleteDocument(id?: string) {
    if (!profile.id || !id) return;
    const response = await deleteRelatedRecord("document", id);
    if (!response.ok) alert(response.error);
    await loadRelated(profile.id);
  }

  async function saveExperience(item: Experience) {
    if (!profile.id) return false;
    const response = await saveRelatedRecord("experience", { ...item, ...experienceSaveState(item) }, item.id);
    if (!response.ok) {
      alert(response.error);
      return false;
    }
    await loadRelated(profile.id);
    return true;
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

    const hasReferenceDetail = isReferenceUponRequest(item) || [item.name, item.role, item.company, item.phone, item.email].some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    if (!hasReferenceDetail) {
      setReferenceStatus({ type: "error", message: "Add a reference name/company, role, phone or email, or choose references available upon request." });
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
    setReferenceStatus(null);
    return true;
  }

  async function deleteReference(id?: string) {
    if (!profile.id || !id) return;
    const response = await deleteRelatedRecord("reference", id);
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
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "portfolio") window.location.replace("/my-blue");
  }, []);

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen p-8 text-slate-900">
        <div className="bd-ocean-content">Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-3 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8">
      <div className="bd-ocean-content mx-auto max-w-[1520px]">
        <header className="bd-glass-card-strong overflow-hidden rounded-[30px]">
          <div className="bd-brand-rule h-1.5" />
          <div className="p-5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">BlueDeck Profile</p>
            <h1 className="bd-serif mt-3 text-3xl font-normal text-[#071f3c] sm:text-5xl">
              {profile.full_name || "Professional Crew Profile"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Build a clean yachting CV from verified profile data, documents,
              work preferences, skills and references.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Snapshot label="Crew ID" value={profile.public_crew_id || "-"} tone="navy" />
              <Snapshot label="Experience" value={`${totalExperienceYears} yrs`} tone="cyan" />
              <Snapshot label="Documents" value={String(documents.length)} tone="gold" />
              <Snapshot label="Alerts" value={String(expiryAlerts.length)} tone="rose" />
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

        <section className="mt-6 min-w-0 overflow-hidden rounded-[24px] border border-[#2fb6c7]/25 bg-white shadow-2xl shadow-slate-950/14 sm:rounded-[28px]">
          <div className="h-1 bg-[linear-gradient(90deg,#07313b_0%,#8ed8e6_36%,#21aebf_72%,#0a4452_100%)]" />
          <div className="border-b border-white/12 bg-[linear-gradient(135deg,#08242e_0%,#0e4f5d_54%,#106f7f_100%)] px-4 py-5 text-white sm:px-6">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#8ed8e6]">BlueDeck CV Studio</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{activeStudioTabInfo.label}</h2>
                <p className="mt-1 text-sm font-semibold text-white/70">{activeStudioTabInfo.description}</p>
              </div>
              <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                <CvCompletionRing percent={cvCompletionPercent} />
                <span className="min-w-0 truncate rounded-full border border-[#8ed8e6]/35 bg-white/10 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-black/10">
                  {activeStudioTabInfo.status}
                </span>
              </div>
            </div>
          </div>

          <div className="min-w-0 border-b border-[#2fb6c7]/25 bg-[linear-gradient(135deg,#0b5160_0%,#108094_52%,#0a4a58_100%)] px-3 pb-3 sm:px-5">
            <div className="bd-profile-studio-tabs flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overflow-y-hidden rounded-[22px] border border-white/18 bg-white/[0.10] p-2 shadow-inner shadow-black/10">
              {studioTabs.map((tab) => {
                const active = activeStudioTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => {
                      setActiveStudioTab(tab.id);
                      if (tab.id !== "skills") setOpenSkillsGroup(null);
                      event.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                    }}
                    className={`bd-profile-studio-tab group flex shrink-0 snap-start items-center gap-2.5 overflow-hidden rounded-[18px] border px-3 py-3 text-left transition sm:gap-3 sm:px-3.5 sm:py-3.5 ${
                      active
                        ? "border-[#c9f7ff] bg-[#f8fbfc] text-[#06111f] shadow-xl shadow-[#062c35]/20"
                        : "border-white/18 bg-white/10 text-white/86 hover:border-[#c9f7ff]/70 hover:bg-white/16 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        active ? "border-[#08313b] bg-[#08313b] text-[#8ed8e6]" : "border-white/18 bg-white/10 text-[#d4fbff] group-hover:bg-white/16"
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black">{tab.label}</span>
                      <span className={`mt-1 block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${active ? "bg-[#e6f8fb] text-[#2d7482]" : "bg-white/12 text-white/72"}`}>{tab.status}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 bg-[#f6f9fa] p-2.5 sm:p-5">
            <div className="contents">
            <Panel
              active={activeStudioTab === "personal"}
              title="Personal details"
              icon={<UserRound className="h-5 w-5" />}
            >
              <div className="space-y-5">
                <div className="grid gap-5 border-b border-slate-200 pb-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
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
                  <TextArea
                    label="Professional summary"
                    value={profile.bio || ""}
                    onChange={(value) => setProfile({ ...profile, bio: value.slice(0, professionalSummaryMaxLength) })}
                    className=""
                    textareaClassName="min-h-32 resize-y text-base sm:text-sm"
                    maxLength={professionalSummaryMaxLength}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Name and surname" value={profile.full_name} onChange={(value) => setProfile({ ...profile, full_name: value })} profileField />
                  <div>
                    <p className={profileFieldLabelClassName}>Position</p>
                    <DropdownChoiceGroup
                      title="Position"
                      options={yachtPositionTitles}
                      value={currentPositionValue ? [currentPositionValue] : []}
                      onChange={(value) => {
                        const nextPosition = cleanSaveText(value[0]);
                        setProfile((current) => ({
                          ...current,
                          current_position: nextPosition,
                          current_positions: nextPosition ? [nextPosition] : [],
                        }));
                      }}
                      selectedAsTitle
                      singleSelect
                      profileField
                    />
                  </div>
                  <DateField label="Date of birth" value={profile.date_of_birth} onChange={(value) => setProfile({ ...profile, date_of_birth: value })} profileField />
                  <NationalitySelect value={profile.nationality || ""} onChange={(value) => setProfile({ ...profile, nationality: value })} />
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-5 md:grid-cols-5 [&>*]:min-w-0">
                  <div className="col-span-2 md:col-span-1">
                    <SelectField label="Gender" value={profile.gender || ""} options={["Female", "Male"]} onChange={(value) => setProfile({ ...profile, gender: value })} />
                  </div>
                  <Field
                    label="Height cm"
                    value={String(profile.height_cm || "")}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    normalizeValue={normalizeThreeDigitNumber}
                    onChange={(value) => setProfile({ ...profile, height_cm: Number(value) || undefined })}
                    profileField
                  />
                  <Field
                    label="Weight kg"
                    value={String(profile.weight_kg || "")}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    normalizeValue={normalizeThreeDigitNumber}
                    onChange={(value) => setProfile({ ...profile, weight_kg: Number(value) || undefined })}
                    profileField
                  />
                  <SelectField label="Smoker" value={profile.smoker || ""} options={["No", "Yes"]} onChange={(value) => setProfile({ ...profile, smoker: value })} />
                  <SelectField label="Visible tattoos" value={profile.visible_tattoos || ""} options={["No", "Yes"]} onChange={(value) => setProfile({ ...profile, visible_tattoos: value })} />
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
                  <PhoneInput label="Mobile number" value={profile.phone || ""} onChange={(value) => setProfile({ ...profile, phone: value })} variant="profile" />
                  <Field label="Email" value={profile.email} onChange={(value) => setProfile({ ...profile, email: value })} profileField />
                  <div className="md:col-span-2">
                    <LocationSelect value={profile.location || ""} onChange={(value) => setProfile({ ...profile, location: value })} />
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => saveProfile()}
                    disabled={saving || !profileDirty}
                    className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition disabled:cursor-default sm:w-auto sm:min-w-32 ${
                      profileDirty
                        ? "bg-[#5fd3e5] text-[#031923] shadow-sm hover:bg-[#84e6f3] disabled:opacity-70"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                    <span aria-live="polite">{saving ? "Saving..." : profileDirty ? "Save" : "Saved"}</span>
                  </button>
                </div>
              </div>
            </Panel>

          </div>

          <div className="contents">
            <Panel active={activeStudioTab === "experience"} title="Yacht experience" icon={<BriefcaseBusiness className="h-5 w-5" />}>
              <div className="space-y-4">
                {referenceStatus?.type === "error" && (
                  <p
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
                  >
                    {referenceStatus.message}
                  </p>
                )}
                <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setNewYachtExperienceOpen(!showNewYachtExperienceForm)}
                    aria-expanded={showNewYachtExperienceForm}
                    aria-controls={newYachtExperienceFormId}
                    className={`bd-focus grid min-h-16 w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 bg-cyan-50/70 px-4 py-3.5 text-left transition hover:bg-cyan-50 sm:px-5 ${showNewYachtExperienceForm ? "border-b border-cyan-100" : ""}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100">
                      <Plus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-950">Add experience</h3>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {newYachtExperienceDirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Unsaved</span>}
                      <ChevronDown className={`h-5 w-5 shrink-0 text-cyan-800 transition ${showNewYachtExperienceForm ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  <div id={newYachtExperienceFormId} hidden={!showNewYachtExperienceForm} className="p-4 sm:p-5">
                    <ExperienceEditor
                      key={`new-${experiences.length}`}
                      item={emptyExperience}
                      isNew
                      references={references}
                      referenceSaving={referenceSaving}
                      onSave={async (item) => {
                        const saved = await saveExperience(item);
                        if (saved) {
                          setNewYachtExperienceDirty(false);
                          setNewYachtExperienceOpen(false);
                        }
                        return saved;
                      }}
                      onDirtyChange={setNewYachtExperienceDirty}
                      onDelete={deleteExperience}
                      onSaveReference={saveReference}
                      onDeleteReference={deleteReference}
                      onUpload={async (file) => uploadFile(file, "crew-portfolio", `experience-photo-new-${editableYachtExperiences.length}`)}
                      onCancelUpload={cancelUpload}
                      uploading={uploading === `experience-photo-new-${editableYachtExperiences.length}`}
                    />
                  </div>
                </section>

                {editableYachtExperiences.length > 0 && (
                  <section className="pt-2">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-800">Saved</h3>
                      <span data-i18n-ignore className="inline-flex min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">
                        {editableYachtExperiences.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {editableYachtExperiences.map((item) => {
                        const uploadSlot = item.id ? `experience-photo-${item.id}` : `experience-photo-${editableYachtExperiences.length}`;

                        return (
                          <ExperienceEditor
                            key={item.id || `${item.yacht_name}-${item.start_date}`}
                            item={item}
                            isNew={false}
                            references={references}
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
                  </section>
                )}
              </div>
            </Panel>

            <Panel active={activeStudioTab === "otherWork"} title="Other work experience" icon={<BriefcaseBusiness className="h-5 w-5" />}>
              <div className="space-y-4">
                {referenceStatus?.type === "error" && (
                  <p
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
                  >
                    {referenceStatus.message}
                  </p>
                )}
                <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setNewOtherWorkExperienceOpen(!showNewOtherWorkExperienceForm)}
                    aria-expanded={showNewOtherWorkExperienceForm}
                    aria-controls={newOtherWorkExperienceFormId}
                    className={`bd-focus grid min-h-16 w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 bg-cyan-50/70 px-4 py-3.5 text-left transition hover:bg-cyan-50 sm:px-5 ${showNewOtherWorkExperienceForm ? "border-b border-cyan-100" : ""}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100">
                      <Plus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-950">Add experience</h3>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {newOtherWorkExperienceDirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Unsaved</span>}
                      <ChevronDown className={`h-5 w-5 shrink-0 text-cyan-800 transition ${showNewOtherWorkExperienceForm ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  <div id={newOtherWorkExperienceFormId} hidden={!showNewOtherWorkExperienceForm} className="p-4 sm:p-5">
                    <OtherWorkExperienceEditor
                      key={`new-other-work-${editableOtherWorkExperiences.length}`}
                      item={emptyOtherWorkExperience}
                      isNew
                      references={references}
                      referenceSaving={referenceSaving}
                      onSave={async (item) => {
                        const saved = await saveExperience(item);
                        if (saved) {
                          setNewOtherWorkExperienceDirty(false);
                          setNewOtherWorkExperienceOpen(false);
                        }
                        return saved;
                      }}
                      onDirtyChange={setNewOtherWorkExperienceDirty}
                      onDelete={deleteExperience}
                      onSaveReference={saveReference}
                      onDeleteReference={deleteReference}
                    />
                  </div>
                </section>

                {editableOtherWorkExperiences.length > 0 && (
                  <section className="pt-2">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-800">Saved</h3>
                      <span data-i18n-ignore className="inline-flex min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">
                        {editableOtherWorkExperiences.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {editableOtherWorkExperiences.map((item) => (
                        <OtherWorkExperienceEditor
                          key={item.id || `${item.yacht_name}-${item.start_date}`}
                          item={item}
                          isNew={false}
                          references={references}
                          referenceSaving={referenceSaving}
                          onSave={saveExperience}
                          onDelete={deleteExperience}
                          onSaveReference={saveReference}
                          onDeleteReference={deleteReference}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </Panel>

            <Panel active={activeStudioTab === "documents"} title="Documents & Certificates" icon={<IdCard className="h-5 w-5" />}>
              <div className="space-y-4">
                <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setNewDocumentOpen(!showNewDocumentForm)}
                    aria-expanded={showNewDocumentForm}
                    aria-controls={newDocumentFormId}
                    className={`bd-focus grid min-h-16 w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 bg-cyan-50/70 px-4 py-3.5 text-left transition hover:bg-cyan-50 sm:px-5 ${showNewDocumentForm ? "border-b border-cyan-100" : ""}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100">
                      <Plus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-950">Add document</h3>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {newDocumentDirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Unsaved</span>}
                      <ChevronDown className={`h-5 w-5 shrink-0 text-cyan-800 transition ${showNewDocumentForm ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  <div id={newDocumentFormId} hidden={!showNewDocumentForm} className="p-4 sm:p-5">
                    <DocumentCreator
                      key={`new-document-${documents.length}`}
                      draft={documentDraft}
                      setDraft={setDocumentDraft}
                      onSave={async (nextDraft) => {
                        const saved = await saveDocument(nextDraft);
                        if (saved) setNewDocumentOpen(false);
                        return saved;
                      }}
                      documentCount={documents.length}
                      maxDocuments={maxCvDocuments}
                    />
                  </div>
                </section>

                {sortedDocuments.length > 0 && (
                  <section className="pt-2">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-800">Saved</h3>
                      <span data-i18n-ignore className="inline-flex min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">
                        {sortedDocuments.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {sortedDocuments.map((document) => (
                        <DocumentCard
                          key={document.id}
                          document={document}
                          onChange={updateDocument}
                          onDelete={deleteDocument}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </Panel>

            <Panel active={activeStudioTab === "languages"} title="Languages" icon={<Languages className="h-5 w-5" />}>
              <LanguagePicker
                value={profile.languages || []}
                onChange={(languages) => {
                  const nextProfile = { ...profile, languages };
                  setProfile(nextProfile);
                  void saveProfile(nextProfile);
                }}
              />
            </Panel>

            <Panel active={activeStudioTab === "skills"} title="Skills & characteristics" icon={<Check className="h-5 w-5" />}>
              <div className="divide-y divide-slate-200">
                <DropdownChoiceGroup
                  title="Personal skills"
                  options={personalSkills}
                  value={profile.personal_skills || []}
                  onChange={(value) => {
                    const nextProfile = { ...profile, personal_skills: value };
                    setProfile(nextProfile);
                    void saveProfile(nextProfile);
                  }}
                  maxSelected={5}
                  inlineSelected
                  commitOnSelect
                  compact
                  open={openSkillsGroup === "personal-skills"}
                  onOpenChange={(open) => setOpenSkillsGroup(open ? "personal-skills" : null)}
                />
                <DropdownChoiceGroup
                  title="Personal characteristics"
                  options={characteristics}
                  value={profile.personal_characteristics || []}
                  onChange={(value) => {
                    const nextProfile = { ...profile, personal_characteristics: value };
                    setProfile(nextProfile);
                    void saveProfile(nextProfile);
                  }}
                  maxSelected={5}
                  inlineSelected
                  commitOnSelect
                  compact
                  open={openSkillsGroup === "personal-characteristics"}
                  onOpenChange={(open) => setOpenSkillsGroup(open ? "personal-characteristics" : null)}
                />
                <DropdownChoiceGroup
                  title="Work preferences"
                  options={workPreferences}
                  value={profile.work_preferences || []}
                  onChange={(value) => {
                    const nextProfile = { ...profile, work_preferences: value };
                    setProfile(nextProfile);
                    void saveProfile(nextProfile);
                  }}
                  maxSelected={5}
                  inlineSelected
                  commitOnSelect
                  compact
                  open={openSkillsGroup === "work-preferences"}
                  onOpenChange={(open) => setOpenSkillsGroup(open ? "work-preferences" : null)}
                />
                <DropdownChoiceGroup
                  title="Seeking positions"
                  options={yachtPositionTitles}
                  value={profile.seeking_positions || []}
                  onChange={(value) => {
                    const nextProfile = { ...profile, seeking_positions: value };
                    setProfile(nextProfile);
                    void saveProfile(nextProfile);
                  }}
                  maxSelected={5}
                  inlineSelected
                  commitOnSelect
                  compact
                  open={openSkillsGroup === "seeking-positions"}
                  onOpenChange={(open) => setOpenSkillsGroup(open ? "seeking-positions" : null)}
                />
              </div>
            </Panel>

            {activeStudioTab === "preview" && (
              <div className="space-y-5">
                <SeazoneStyleCvPreview
                  profile={profile}
                  documents={cvDocuments}
                  experiences={experiences}
                  references={cvReferences}
                  totalExperienceYears={totalExperienceYears}
                  downloading={pdfDownloading}
                  onDownload={async (payload) => {
                    setPdfDownloading(true);
                    try {
                      await downloadCvPdf(payload);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : "CV print dialog could not be opened.");
                    } finally {
                      setPdfDownloading(false);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
        </section>
      </div>
    </main>
  );
}

function DocumentCreator({
  draft,
  setDraft,
  onSave,
  documentCount,
  maxDocuments,
}: {
  draft: CrewDocument;
  setDraft: (draft: CrewDocument) => void;
  onSave: (draft: CrewDocument) => Promise<boolean>;
  documentCount: number;
  maxDocuments: number;
}) {
  const selectedCategory = documentCatalog.find((group) => group.items.includes(draft.document_type))?.category || "";
  const customDocumentName = draft.document_type && !selectedCategory ? draft.document_type : "";
  const documentLimitReached = documentCount >= maxDocuments;
  const [saving, setSaving] = useState(false);
  const formLocked = saving || documentLimitReached;

  async function handleSave() {
    if (formLocked) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Document type</span>
            <select
              aria-label="Document type"
              value={selectedCategory ? draft.document_type : ""}
              disabled={formLocked}
              onChange={(event) => {
                const category = documentCatalog.find((group) => group.items.includes(event.target.value))?.category || "";
                setDraft({ ...draft, document_type: event.target.value, category });
              }}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
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

          <div className="mt-3">
            <Field
              label="Other document name"
              value={customDocumentName}
              placeholder="Other"
              disabled={formLocked}
              mobileFriendly
              onChange={(value) =>
                setDraft({
                  ...draft,
                  document_type: capitalizeFirstCharacter(value),
                  category: value.trim() ? "Other" : "",
                })
              }
            />
          </div>
        </div>

        <div>
          <DateField
            label="Expiry date"
            value={draft.expiry_date}
            onChange={(value) => setDraft({ ...draft, expiry_date: value })}
            disabled={draft.no_expiry || formLocked}
            mobileFriendly
          />
          <div className="mt-2 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 [&>label]:min-h-11 [&>label]:w-full">
            <Checkbox
              label="No expiry / unlimited"
              checked={draft.no_expiry}
              disabled={formLocked}
              onChange={(checked) => setDraft({ ...draft, no_expiry: checked, expiry_date: checked ? "" : draft.expiry_date })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={formLocked}
          onClick={handleSave}
          className="min-h-11 w-full rounded-xl bg-cyan-400 px-5 py-2 text-sm font-semibold text-[#020817] shadow-sm shadow-cyan-950/10 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto sm:min-w-[180px]"
        >
          {saving ? "Saving..." : "Add document"}
        </button>
      </div>

      {documentLimitReached && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Maximum {maxDocuments} documents and certificates can be added to this CV.
        </p>
      )}
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

function shouldBreakBeforeExperience(index: number) {
  return index >= 2 && (index - 2) % 3 === 0;
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

function saveStateEquals(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cleanSaveText(value?: string | null) {
  return (value || "").trim();
}

function normalizeDocumentText(value?: string | null) {
  return cleanSaveText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function catalogCategoryForDocumentType(documentType?: string | null) {
  const cleanType = cleanSaveText(documentType);
  if (!cleanType) return "";
  return documentCatalog.find((group) => group.items.includes(cleanType))?.category || "";
}

function documentDisplayCategory(document: CrewDocument) {
  return cleanSaveText(document.category) || catalogCategoryForDocumentType(document.document_type);
}

function documentSubtitle(document: CrewDocument) {
  const issuer = cleanSaveText(document.issuer);
  if (issuer) return issuer;

  const category = documentDisplayCategory(document);
  if (!category || ["other", "general"].includes(normalizeDocumentText(category))) return "";
  return category;
}

function documentPriorityRank(document: CrewDocument) {
  const type = normalizeDocumentText(document.document_type);
  const category = normalizeDocumentText(documentDisplayCategory(document));
  const combined = `${type} ${category}`;

  if (/\bpassport\b/.test(combined)) return 0;
  if (/\bschengen\b/.test(combined)) return 1;
  if (/\b(seaman|seafarer|discharge)\b/.test(combined)) return 2;
  if (
    category.includes("deck & captain") ||
    /\b(master|captain|chief mate|oow|coc|certificate of competency|yachtmaster|helm|gmdss)\b|\d+\s*gt\b|\bgt\b/.test(combined)
  ) {
    return 3;
  }

  return 10;
}

function documentExpiryTime(document: CrewDocument) {
  if (document.no_expiry || !document.expiry_date) return Number.POSITIVE_INFINITY;
  const time = Date.parse(document.expiry_date);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY - 1;
}

function sortCrewDocuments(documents: CrewDocument[]) {
  return [...documents].sort((first, second) => {
    const priorityDifference = documentPriorityRank(first) - documentPriorityRank(second);
    if (priorityDifference !== 0) return priorityDifference;

    const expiryDifference = documentExpiryTime(first) - documentExpiryTime(second);
    if (expiryDifference !== 0) return expiryDifference;

    return cleanSaveText(first.document_type).localeCompare(cleanSaveText(second.document_type), "en", { sensitivity: "base" });
  });
}

function cleanLimitedText(value: string | null | undefined, maxLength: number) {
  return cleanSaveText(value).slice(0, maxLength);
}

function capitalizeFirstCharacter(value: string) {
  const firstLetterIndex = value.search(/\p{L}/u);
  if (firstLetterIndex === -1) return value;
  return `${value.slice(0, firstLetterIndex)}${value.charAt(firstLetterIndex).toLocaleUpperCase("tr-TR")}${value.slice(firstLetterIndex + 1)}`;
}

const galleryOrderPrefix = "__BLUDECK_GALLERY_ORDER__";

function splitGalleryLocation(value?: string | null) {
  const location = value || "";
  if (!location.startsWith(galleryOrderPrefix)) return { location, order: undefined as number | undefined };
  const lineBreak = location.indexOf("\n");
  const orderText = location.slice(galleryOrderPrefix.length, lineBreak === -1 ? undefined : lineBreak).trim();
  const parsedOrder = Number(orderText);
  return {
    location: lineBreak === -1 ? "" : location.slice(lineBreak + 1),
    order: Number.isFinite(parsedOrder) ? parsedOrder : undefined,
  };
}

function normalizePortfolioRecord(photo: PortfolioPhoto) {
  const parsed = splitGalleryLocation(photo.location);
  return {
    ...photo,
    location: parsed.location,
    gallery_order: typeof photo.gallery_order === "number" ? photo.gallery_order : parsed.order,
  };
}

function portfolioSortValue(photo: PortfolioPhoto, index: number) {
  if (typeof photo.gallery_order === "number" && Number.isFinite(photo.gallery_order)) return photo.gallery_order;
  const createdAt = photo.created_at ? Date.parse(photo.created_at) : 0;
  return createdAt ? -createdAt : index;
}

function sortPortfolioPhotos(photos: PortfolioPhoto[]) {
  return [...photos].sort((first, second) => {
    const firstIndex = photos.indexOf(first);
    const secondIndex = photos.indexOf(second);
    return portfolioSortValue(first, firstIndex) - portfolioSortValue(second, secondIndex);
  });
}

function cvPdfFileName(profile: CrewProfile) {
  const name = cleanSaveText(profile.full_name)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
  return `${name || "BLUEDECK CREW"} - CV BlueDeck Yacht Management Platform.pdf`;
}

type CvPdfPayload = {
  profile: CrewProfile;
  documents: CrewDocument[];
  experiences: Experience[];
  references: ReferenceEntry[];
  professionalSummary: string;
  totalExperienceYears: string;
  crewName: string;
  primaryPosition: string;
  visibleSkills: string[];
};

async function downloadCvPdf(payload: CvPdfPayload) {
  const root = document.querySelector<HTMLElement>("#bluedeck-cv .bd-cv-print-root");
  const pages = root ? Array.from(root.querySelectorAll<HTMLElement>(".bd-print-page")) : [];

  if (!root || pages.length === 0) {
    throw new Error("CV preview is not ready yet.");
  }

  await waitForCvPrintAssets(root);
  const restoreExportImages = await prepareCvExportImages(root);
  await waitForCvPrintAssets(root);
  await waitForNextPaint();
  openCvPrintDialog(cvPdfFileName(payload.profile), restoreExportImages);
}

function openCvPrintDialog(fileName: string, cleanup?: () => void) {
  const previousTitle = document.title;
  const printTitle = fileName.replace(/\.pdf$/i, "");
  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    window.clearTimeout(restoreTimeout);
    document.title = previousTitle;
    cleanup?.();
  };

  document.title = printTitle;
  window.addEventListener("afterprint", restoreTitle, { once: true });
  const restoreTimeout = window.setTimeout(restoreTitle, 10 * 60 * 1000);
  window.print();
}

async function prepareCvExportImages(root: HTMLElement) {
  const restore: Array<() => void> = [];
  const images = Array.from(root.querySelectorAll("img"));
  const backgroundElements = Array.from(root.querySelectorAll<HTMLElement>("[style*='background-image']"));

  await Promise.all(
    images.map(async (image) => {
      const source = image.currentSrc || image.src;
      if (!source || source.startsWith("data:")) return;

      const dataUrl = (await imageSourceToDataUrl(source, cvImageProxyOptionsForElement(image))) || domImageToDataUrl(image);
      if (!dataUrl) return;

      const previousSource = image.getAttribute("src");
      const previousSourceSet = image.getAttribute("srcset");
      restore.push(() => {
        if (previousSource === null) image.removeAttribute("src");
        else image.setAttribute("src", previousSource);
        if (previousSourceSet === null) image.removeAttribute("srcset");
        else image.setAttribute("srcset", previousSourceSet);
      });
      image.removeAttribute("srcset");
      image.setAttribute("src", dataUrl);
      image.src = dataUrl;
    }),
  );

  await Promise.all(
    backgroundElements.map(async (element) => {
      const source = cssBackgroundImageUrl(element.style.backgroundImage);
      if (!source || source.startsWith("data:")) return;

      const dataUrl = await imageSourceToDataUrl(source, cvImageProxyOptionsForElement(element));
      if (!dataUrl) return;

      const previousBackground = element.style.backgroundImage;
      restore.push(() => {
        element.style.backgroundImage = previousBackground;
      });
      element.style.backgroundImage = `url("${dataUrl}")`;
    }),
  );

  return () => {
    [...restore].reverse().forEach((restoreItem) => restoreItem());
  };
}

type CvImageProxyOptions = {
  width?: number;
  height?: number;
  max?: number;
  fit?: "cover" | "contain" | "inside";
};

function cvImageProxyOptionsForElement(element: Element): CvImageProxyOptions {
  if (element.closest(".bd-print-avatar")) return { width: 720, height: 720, fit: "cover" };
  if (element.closest(".bd-print-brand-logo")) return { max: 720, fit: "contain" };
  if (element.closest(".bd-print-experience-meta")) return { width: 720, height: 520, fit: "cover" };
  return { max: 1800 };
}

async function imageSourceToDataUrl(source: string, options: CvImageProxyOptions = {}) {
  try {
    const response = await fetch(cvImageRequestSource(source, options), { cache: "force-cache" });
    if (!response.ok) return "";
    const blob = await response.blob();
    if (!blob.type.toLowerCase().startsWith("image/")) return "";
    return blobToDataUrl(blob);
  } catch {
    return "";
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

function domImageToDataUrl(image: HTMLImageElement) {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return "";

    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function cssBackgroundImageUrl(value: string) {
  return value.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForCvPrintAssets(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;

  images.forEach((image) => {
    image.loading = "eager";
    image.decoding = "sync";
    (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";
  });

  const sources = Array.from(new Set(images.map((image) => image.currentSrc || image.src).filter(Boolean)));

  await Promise.race([
    Promise.all(
      sources.map((source) => preloadPrintImage(source)),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, 3500)),
  ]);

  await Promise.race([
    Promise.all(images.map((image) => waitForDomPrintImage(image))),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1800)),
  ]);
}

function preloadPrintImage(source: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "sync";
    image.loading = "eager";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = source;
    if (image.complete) resolve();
  });
}

function waitForDomPrintImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  if (image.decode) return image.decode().catch(() => undefined);

  return new Promise<void>((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

function cvImageRequestSource(source: string, options: CvImageProxyOptions = {}) {
  const sameOriginSource = typeof window !== "undefined" && source.startsWith(window.location.origin);
  if (source.startsWith("/") || sameOriginSource) return source;

  const params = new URLSearchParams({ src: source });
  if (options.width) params.set("w", String(options.width));
  if (options.height) params.set("h", String(options.height));
  if (options.max) params.set("max", String(options.max));
  if (options.fit) params.set("fit", options.fit);
  return `/api/cv-image?${params.toString()}`;
}

type YachtSizeUnit = "ft" | "m";

function parseYachtSize(value?: string | null): { amount: string; unit: YachtSizeUnit } {
  const cleanValue = cleanSaveText(value).toLowerCase();
  const amount = cleanValue.replace(/[^\d]/g, "");
  const unit: YachtSizeUnit = /\bm\b|meter|metre/.test(cleanValue) ? "m" : "ft";
  return { amount, unit };
}

function composeYachtSize(amount: string, unit: YachtSizeUnit) {
  const cleanAmount = amount.replace(/[^\d]/g, "");
  return cleanAmount ? `${cleanAmount} ${unit}` : "";
}

function normalizeYachtSize(value?: string | null) {
  const parsed = parseYachtSize(value);
  return composeYachtSize(parsed.amount, parsed.unit);
}

const experienceMetadataPrefix = "__BLUDECK_EXPERIENCE_META__";

function splitExperienceDescription(value?: string) {
  const description = value || "";
  if (!description.startsWith(experienceMetadataPrefix)) {
    return { description, meta: {} as Partial<Experience> };
  }

  const lineBreak = description.indexOf("\n");
  const metaText = description.slice(experienceMetadataPrefix.length, lineBreak === -1 ? undefined : lineBreak).trim();
  const cleanDescription = lineBreak === -1 ? "" : description.slice(lineBreak + 1);

  try {
    const meta = JSON.parse(metaText) as Partial<Experience>;
    return { description: cleanDescription, meta };
  } catch {
    return { description: cleanDescription, meta: {} as Partial<Experience> };
  }
}

function normalizeExperienceRecord(experience: Experience) {
  const parsed = splitExperienceDescription(experience.description);
  return {
    ...experience,
    yacht_type: cleanSaveText(experience.yacht_type) || cleanSaveText(parsed.meta.yacht_type),
    yacht_program: cleanSaveText(experience.yacht_program) || cleanSaveText(parsed.meta.yacht_program),
    yacht_size: normalizeYachtSize(experience.yacht_size) || normalizeYachtSize(parsed.meta.yacht_size),
    location: cleanSaveText(experience.location) || cleanSaveText(parsed.meta.location),
    description: parsed.description,
  };
}

function isOtherWorkExperience(experience: Experience) {
  return cleanSaveText(experience.yacht_type) === otherWorkExperienceMarker;
}

function normalizeOtherWorkExperience(experience: Experience) {
  return {
    ...experience,
    yacht_type: otherWorkExperienceMarker,
    yacht_program: "Other work",
    yacht_size: "",
    photo_url: "",
  };
}

function displayExperienceTitle(experience: Experience) {
  if (isOtherWorkExperience(experience)) return cleanSaveText(experience.yacht_name) || "Workplace";
  return cleanSaveText(experience.yacht_name) || "Yacht";
}

function displayExperienceMetaParts(experience: Experience) {
  if (isOtherWorkExperience(experience)) return [];
  return [experience.yacht_type, experience.yacht_program, experience.yacht_size].filter(Boolean);
}

function isReferenceUponRequest(reference: ReferenceEntry) {
  const name = cleanSaveText(reference.name).toLowerCase();
  return cleanSaveText(reference.notes) === referenceUponRequestMarker || name === referenceUponRequestText.toLowerCase();
}

function referenceUponRequestEntry(targetName: string, existing?: ReferenceEntry): ReferenceEntry {
  return {
    ...emptyReference,
    ...(existing || {}),
    name: referenceUponRequestText,
    role: "",
    vessel: targetName,
    company: "",
    phone: "",
    email: "",
    notes: referenceUponRequestMarker,
    show_on_cv: true,
  };
}

function cleanSaveNumber(value?: number | null) {
  return value ? String(value) : "";
}

function cleanSaveList(value?: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanSaveText(typeof item === "string" ? item : "")).filter(Boolean);
}

function getProfileCurrentPosition(profile: CrewProfile) {
  return cleanSaveText(profile.current_position) || cleanSaveList(profile.current_positions)[0] || "";
}

function calculateCvCompletion({
  profile,
  yachtExperiences,
  otherWorkExperiences,
}: {
  profile: CrewProfile;
  documents: CrewDocument[];
  yachtExperiences: Experience[];
  otherWorkExperiences: Experience[];
  references: ReferenceEntry[];
  portfolio: PortfolioPhoto[];
}) {
  const visibleSkills = [
    ...(profile.personal_skills || []),
    ...(profile.personal_characteristics || []),
  ].filter(Boolean);
  const visiblePreferences = (profile.work_preferences || []).filter(Boolean);
  const visibleLanguages = (profile.languages || []).filter((language) => language.name && language.level);
  const allExperiences = [...yachtExperiences, ...otherWorkExperiences];
  const firstPageExperienceScore =
    allExperiences
      .slice(0, 3)
      .reduce((sum, experience) => sum + experienceCompletionRatio(experience), 0) / 3;
  const completionChecks: Array<{ ratio: number; weight: number }> = [
    { ratio: profile.profile_photo_url ? 1 : 0, weight: 8 },
    { ratio: cleanSaveText(profile.full_name) ? 1 : 0, weight: 5 },
    { ratio: getProfileCurrentPosition(profile) ? 1 : 0, weight: 5 },
    {
      ratio: filledRatio([
        profile.date_of_birth,
        profile.nationality,
        profile.gender,
        profile.height_cm,
        profile.weight_kg,
        profile.smoker,
        profile.visible_tattoos,
      ]),
      weight: 14,
    },
    { ratio: filledRatio([profile.phone, profile.email, profile.location]), weight: 12 },
    { ratio: textCompletionRatio(profile.bio, 200), weight: 14 },
    { ratio: firstPageExperienceScore, weight: 24 },
    { ratio: Math.min(visibleLanguages.length / 4, 1), weight: 6 },
    { ratio: Math.min(visibleSkills.length / 10, 1), weight: 8 },
    { ratio: Math.min(visiblePreferences.length / 5, 1), weight: 4 },
  ];
  const totalWeight = completionChecks.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = completionChecks.reduce((sum, item) => sum + item.ratio * item.weight, 0);
  return Math.max(0, Math.min(100, Math.round((completedWeight / totalWeight) * 100)));
}

function filledRatio(values: Array<unknown>) {
  if (values.length === 0) return 0;
  const filled = values.filter((value) => {
    if (typeof value === "number") return value > 0;
    return Boolean(cleanSaveText(typeof value === "string" ? value : ""));
  }).length;
  return filled / values.length;
}

function textCompletionRatio(value: string | undefined, fullLength: number) {
  return Math.min(cleanSaveText(value).length / fullLength, 1);
}

function experienceCompletionRatio(experience: Experience) {
  const isOtherWork = isOtherWorkExperience(experience);
  const fields = [
    cleanSaveText(experience.yacht_name),
    cleanSaveText(experience.position),
    cleanSaveText(experience.start_date),
    cleanSaveText(experience.end_date),
    cleanSaveText(experience.location),
    isOtherWork ? "other-work" : cleanSaveText(experience.yacht_type),
    isOtherWork ? "other-work" : cleanSaveText(experience.yacht_program),
    isOtherWork ? "other-work" : cleanSaveText(experience.yacht_size),
  ];
  const fieldScore = filledRatio(fields) * 0.5;
  const dutiesScore = textCompletionRatio(experience.description, 160) * 0.5;
  return fieldScore + dutiesScore;
}

function inferBaseRoleFromPosition(value?: string) {
  const position = cleanSaveText(value).toLowerCase();
  if (position.includes("captain")) return "captain";
  if (position.includes("owner")) return "owner";
  if (position.includes("management")) return "management";
  return "crew";
}

function cleanSaveLanguages(value?: LanguageEntry[]) {
  return (value || []).map((language) => ({
    name: cleanSaveText(language.name),
    level: cleanSaveText(language.level),
  }));
}

function profileSaveState(profile: CrewProfile) {
  const currentPosition = getProfileCurrentPosition(profile);

  return {
    profile_photo_url: cleanSaveText(profile.profile_photo_url),
    full_name: cleanSaveText(profile.full_name),
    email: cleanSaveText(profile.email),
    phone: cleanSaveText(profile.phone),
    gender: cleanSaveText(profile.gender),
    nationality: cleanSaveText(profile.nationality),
    current_position: currentPosition,
    location: cleanSaveText(profile.location),
    bio: cleanLimitedText(profile.bio, professionalSummaryMaxLength),
    date_of_birth: cleanSaveText(profile.date_of_birth),
    height_cm: cleanSaveNumber(profile.height_cm),
    weight_kg: cleanSaveNumber(profile.weight_kg),
    visible_tattoos: cleanSaveText(profile.visible_tattoos),
    smoker: cleanSaveText(profile.smoker),
    current_positions: currentPosition ? [currentPosition] : [],
    seeking_positions: cleanSaveList(profile.seeking_positions),
    work_preferences: cleanSaveList(profile.work_preferences),
    personal_skills: cleanSaveList(profile.personal_skills),
    personal_characteristics: cleanSaveList(profile.personal_characteristics),
    languages: cleanSaveLanguages(profile.languages),
  };
}

function experienceSaveState(experience: Experience) {
  return {
    yacht_name: cleanSaveText(experience.yacht_name),
    yacht_type: cleanSaveText(experience.yacht_type),
    yacht_program: cleanSaveText(experience.yacht_program),
    yacht_size: normalizeYachtSize(experience.yacht_size),
    location: cleanSaveText(experience.location),
    position: cleanSaveText(experience.position),
    start_date: cleanSaveText(experience.start_date),
    end_date: cleanSaveText(experience.end_date),
    description: cleanLimitedText(experience.description, yachtDutiesMaxLength),
    photo_url: cleanSaveText(experience.photo_url),
  };
}

function referenceSaveState(reference: ReferenceEntry) {
  return {
    name: cleanSaveText(reference.name || reference.company),
    role: cleanSaveText(reference.role),
    phone: cleanSaveText(reference.phone),
    email: cleanSaveText(reference.email),
    notes: cleanSaveText(reference.notes),
  };
}

function documentSaveState(document: CrewDocument) {
  return {
    document_type: cleanSaveText(document.document_type),
    category: cleanSaveText(document.category),
    expiry_date: cleanSaveText(document.expiry_date),
    no_expiry: Boolean(document.no_expiry),
    show_on_cv: Boolean(document.show_on_cv),
    file_url: cleanSaveText(document.file_url),
  };
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
  return referenceMatchesTargetName(reference, experience.yacht_name);
}

function referenceMatchesTargetName(reference: ReferenceEntry, targetName: string) {
  const vessel = normalizeVesselName(reference.vessel);
  const target = normalizeVesselName(targetName);
  if (!vessel || !target) return false;
  if (vessel === target) return true;
  return vessel.length >= 3 && target.length >= 3 && (vessel.includes(target) || target.includes(vessel));
}

function referencesForExperience(experience: Experience, references: ReferenceEntry[]) {
  return references.filter((reference) => referenceMatchesExperience(reference, experience));
}

function cvReferencesForExperience(experience: Experience, references: ReferenceEntry[]) {
  const linkedReferences = referencesForExperience(experience, references);
  const requestReference = linkedReferences.find(isReferenceUponRequest);
  if (requestReference) return [requestReference];
  return linkedReferences.filter((reference) => !isReferenceUponRequest(reference));
}

function referenceDisplayName(reference: ReferenceEntry) {
  if (isReferenceUponRequest(reference)) return referenceUponRequestCvText;
  const name = cleanSaveText(reference.name);
  if (name && name.toLowerCase() !== "reference") return name;
  return cleanSaveText(reference.company) || cleanSaveText(reference.vessel) || "Contact";
}

function referenceDetailText(reference: ReferenceEntry, fallback = "Yacht reference") {
  if (isReferenceUponRequest(reference)) return "Professional references available upon request";
  return [reference.role, reference.vessel || reference.company].filter(Boolean).join(" / ") || fallback;
}

function referenceContactText(reference: ReferenceEntry) {
  if (isReferenceUponRequest(reference)) return "";
  return [reference.email, reference.phone].filter(Boolean).join(" / ");
}

function documentPayloadForSave(document: CrewDocument) {
  return {
    ...document,
    issue_date: cleanSaveText(document.issue_date) || null,
    expiry_date: document.no_expiry ? null : cleanSaveText(document.expiry_date) || null,
  };
}

function SeazoneStyleCvPreview({
  profile,
  documents,
  experiences,
  references,
  totalExperienceYears,
  downloading,
  onDownload,
}: {
  profile: CrewProfile;
  documents: CrewDocument[];
  experiences: Experience[];
  references: ReferenceEntry[];
  totalExperienceYears: string;
  downloading: boolean;
  onDownload: (payload: CvPdfPayload) => void | Promise<void>;
}) {
  const primaryPosition = profile.current_positions?.[0] || profile.current_position || "Yacht Crew";
  const cleanYachtExperiences = experiences.filter((item) => !isOtherWorkExperience(item) && (item.yacht_name || item.position || item.description));
  const cleanOtherWorkExperiences = experiences.filter((item) => isOtherWorkExperience(item) && (item.yacht_name || item.position || item.description));
  const cleanExperiences = [...cleanYachtExperiences, ...cleanOtherWorkExperiences];
  const cleanReferences = cleanReferenceEntries(references);
  const visibleSkills = [...(profile.personal_skills || []), ...(profile.personal_characteristics || [])].slice(0, 18);
  const crewName = profile.full_name || "Crew Member";
  const professionalSummary =
    profile.bio?.trim() ||
    `I am a ${primaryPosition.toLowerCase()} looking for a professional yacht opportunity. I am reliable, guest-focused and ready to contribute to a well-run crew.`;

  return (
    <section
      id="bluedeck-cv"
      className="bd-cv-root overflow-hidden rounded-[24px] border border-[#d8e2e6] bg-[#f3f7f8] text-slate-950 shadow-xl shadow-slate-950/10 print:rounded-none print:border-0 print:bg-white print:shadow-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b9c8cd] bg-white px-5 py-4 print:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#228fc4]">BlueDeck crew CV</p>
          <p className="mt-1 text-sm text-slate-500">Minimal maritime CV generated from your saved profile.</p>
        </div>
        <button
          onClick={() =>
            onDownload({
              profile,
              documents,
              experiences: cleanExperiences,
              references: cleanReferences,
              professionalSummary,
              totalExperienceYears,
              crewName,
              primaryPosition,
              visibleSkills,
            })
          }
          disabled={downloading}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#5fd3e5] px-4 py-3 text-sm font-black text-[#031923] shadow-lg shadow-cyan-950/15 transition hover:bg-[#86e7f3] disabled:cursor-progress disabled:opacity-70 sm:w-auto"
        >
          {downloading ? <Plus className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {downloading ? "Opening print..." : "Print / Save PDF"}
        </button>
      </div>

      <CvScaleFrame>
        <div className="bd-cv-sheet mx-auto w-[980px] max-w-none overflow-hidden rounded-[18px] border border-[#d8e2e6] bg-white shadow-xl shadow-slate-950/10 print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="bd-cv-layout grid min-h-[1120px] grid-cols-[320px_1fr] bg-white print:min-h-0 print:grid-cols-[300px_1fr]">
            <aside className="bd-cv-sidebar relative bg-[#e7ecee] px-7 pb-8 pt-56 text-[#242a31] print:pt-56">
              <CvSidebarSignature />
              <div className="bd-cv-avatar absolute right-[-42px] top-8 z-20 h-44 w-44 translate-x-0 overflow-hidden rounded-full border-[10px] border-white bg-white shadow-xl shadow-slate-950/12">
                {profile.profile_photo_url ? (
                  <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#edf3f5] text-[#2d7482]">
                    <UserRound className="h-16 w-16" />
                  </div>
                )}
              </div>

              <div className="bd-cv-side-stack space-y-8">
                <SeazoneSideSection title="Profile">
                  <div className="space-y-2.5">
                    <SeazoneSidebarLine label="Date of Birth" value={formatCvDate(profile.date_of_birth)} />
                    <SeazoneSidebarLine label="Nationality" value={profile.nationality || "-"} />
                    <SeazoneSidebarLine label="Gender" value={profile.gender || "-"} />
                    <SeazoneSidebarLine label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : "-"} />
                    <SeazoneSidebarLine label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : "-"} />
                    <SeazoneSidebarLine label="Smoker" value={profile.smoker || "-"} />
                    <SeazoneSidebarLine label="Visible tattoos" value={profile.visible_tattoos || "-"} />
                  </div>
                </SeazoneSideSection>

                <SeazoneSideSection title="Contact">
                  <div className="space-y-2.5 text-sm font-semibold text-[#3d454c]">
                    <SeazoneContactLine icon={<Phone className="h-3.5 w-3.5" />} value={profile.phone || "-"} />
                    <SeazoneContactLine icon={<Mail className="h-3.5 w-3.5" />} value={profile.email || "-"} />
                    <SeazoneContactLine icon={<MapPin className="h-3.5 w-3.5" />} value={profile.location || "-"} />
                  </div>
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

                <SeazoneSideSection title="Skills & Characteristics">
                  <PillList items={visibleSkills} light />
                </SeazoneSideSection>

                <SeazoneSideSection title="Preferences">
                  <PillList items={profile.work_preferences || []} light />
                </SeazoneSideSection>

                <SeazoneSideSection title="Documents & Certificates" className="bd-cv-documents-section">
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-sm text-[#6b747a]">No CV documents selected.</p>}
                    {documents.slice(0, maxCvDocuments).map((doc) => (
                      <SeazoneDocumentRow key={doc.id || doc.document_type} document={doc} />
                    ))}
                  </div>
                </SeazoneSideSection>

                <div className="bd-cv-qr-section rounded-2xl border border-[#cbd7dc] bg-white p-4 text-[#40535d]">
                  <CrewProfileQr crewId={profile.public_crew_id} />
                  <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#6b747a]">{profile.public_crew_id || "Crew ID"}</p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#2d7482]">Photo Gallery</p>
                  <p className="mt-1 text-sm font-semibold">Scan to view verified yacht work photos on BlueDeck.</p>
                </div>
              </div>
            </aside>

            <div className="bg-white">
              <header className="bd-cv-header relative bg-transparent pb-3 pt-8 text-white print:py-9">
                <div className="bd-cv-name-band mr-10 -ml-10 flex min-h-[150px] items-center rounded-r-full bg-[#20242a] px-8 pl-28 shadow-lg shadow-slate-950/10">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8ed8e6]">Verified Crew Profile</p>
                    <h2 className="bd-cv-crew-name mt-3 block max-w-full whitespace-nowrap font-black uppercase leading-none text-white" style={crewNameStyle(crewName)}>{crewName}</h2>
                    <p className="mt-3 text-lg font-semibold tracking-[0.26em] text-white/82">{primaryPosition}</p>
                  </div>
                </div>
              </header>

              <main className="bd-cv-main p-6 sm:p-8 print:p-7">
                <SeazoneSection title="About Me" className="mt-0">
                  <p className="rounded-2xl border border-[#b8c9d0] bg-white p-4 text-[14px] font-semibold leading-7 text-[#17232c]">
                    {professionalSummary}
                  </p>
                </SeazoneSection>

                <SeazoneSection title="Yacht Experience" badge={`${totalExperienceYears} years`}>
                <div className="bd-cv-experience-list space-y-4">
                  {cleanYachtExperiences.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#c7d2d6] bg-[#f6f8f8] p-5 text-sm text-[#5a6870]">
                      No yacht experience added yet.
                    </p>
                  )}
                  {cleanYachtExperiences.map((item, index) => (
                    <SeazoneExperienceCard
                      key={item.id || `${item.yacht_name}-${item.start_date}`}
                      experience={item}
                      references={cvReferencesForExperience(item, cleanReferences)}
                      breakBefore={shouldBreakBeforeExperience(index)}
                    />
                  ))}
                </div>
              </SeazoneSection>

              {cleanOtherWorkExperiences.length > 0 && (
                <SeazoneSection title="Other Work Experience">
                  <div className="bd-cv-experience-list space-y-4">
                    {cleanOtherWorkExperiences.map((item, index) => (
                      <SeazoneExperienceCard
                        key={item.id || `${item.yacht_name}-${item.start_date}`}
                        experience={item}
                        references={cvReferencesForExperience(item, cleanReferences)}
                        breakBefore={shouldBreakBeforeExperience(cleanYachtExperiences.length + index)}
                      />
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
      </CvScaleFrame>
      <PrintableCvPages
        profile={profile}
        documents={documents}
        experiences={cleanExperiences}
        references={cleanReferences}
        professionalSummary={professionalSummary}
        totalExperienceYears={totalExperienceYears}
        crewName={crewName}
        primaryPosition={primaryPosition}
        visibleSkills={visibleSkills}
      />
    </section>
  );
}

function CrewProfileQr({ crewId }: { crewId?: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const profileUrl = useMemo(
    () => (crewId ? absoluteSiteUrl(`/crew/${encodeURIComponent(crewId)}/gallery`) : ""),
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
      title={`Open public photo gallery: ${profileUrl}`}
    >
      {qrDataUrl ? (
        <img src={qrDataUrl} alt={`QR code for BlueDeck photo gallery ${crewId}`} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">QR loading</span>
      )}
      <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#173f4a] text-white shadow-lg shadow-[#173f4a]/20 opacity-0 transition group-hover:opacity-100">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

function PrintableCrewProfileQr({ crewId }: { crewId?: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const profileUrl = useMemo(
    () => (crewId ? absoluteSiteUrl(`/crew/${encodeURIComponent(crewId)}/gallery`) : ""),
    [crewId],
  );

  useEffect(() => {
    let cancelled = false;

    if (!profileUrl) return;

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
    return <div className="bd-print-qr-link"><span>Save profile</span></div>;
  }

  return (
    <a href={profileUrl} className="bd-print-qr-link">
      {qrDataUrl ? <img src={qrDataUrl} alt={`QR code for BlueDeck photo gallery ${crewId}`} /> : <span>QR loading</span>}
    </a>
  );
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function PrintableCvPages({
  profile,
  documents,
  experiences,
  references,
  professionalSummary,
  totalExperienceYears,
  crewName,
  primaryPosition,
  visibleSkills,
}: {
  profile: CrewProfile;
  documents: CrewDocument[];
  experiences: Experience[];
  references: ReferenceEntry[];
  professionalSummary: string;
  totalExperienceYears: string;
  crewName: string;
  primaryPosition: string;
  visibleSkills: string[];
}) {
  const firstPageExperiences = experiences.slice(0, 3);
  const remainingPages = chunkItems(experiences.slice(3), 4);
  const pages = [
    { kind: "first" as const, experiences: firstPageExperiences },
    ...remainingPages.map((items) => ({ kind: "continued" as const, experiences: items })),
  ];
  if (pages.length === 1 && firstPageExperiences.length === 0) {
    pages[0].experiences = [];
  }

  return (
    <div className="bd-cv-print-root" aria-hidden="true">
      {pages.map((page, pageIndex) => (
        <section className="bd-print-page" key={`${page.kind}-${pageIndex}`}>
          <aside className="bd-print-sidebar">
            {pageIndex === 0 ? (
              <PrintablePrimarySidebar profile={profile} documents={documents} visibleSkills={visibleSkills} />
            ) : pageIndex === 1 ? (
              <PrintableDocumentSidebar profile={profile} documents={documents} />
            ) : (
              <PrintableContinuationSidebar profile={profile} />
            )}
          </aside>

          <main className={`bd-print-main ${pageIndex > 0 ? "bd-print-main-continuation" : ""}`}>
            {pageIndex === 0 ? (
              <>
                <PrintableHero profile={profile} crewName={crewName} primaryPosition={primaryPosition} />
                <PrintableSection title="About Me">
                  <p className="bd-print-summary">{professionalSummary}</p>
                </PrintableSection>
                <PrintableSection
                  title={page.experiences.some((experience) => !isOtherWorkExperience(experience)) ? "Yacht Experience" : "Other Work Experience"}
                  badge={page.experiences.some((experience) => !isOtherWorkExperience(experience)) ? `${totalExperienceYears} years` : undefined}
                >
                  <PrintableExperienceList experiences={page.experiences} references={references} />
                </PrintableSection>
              </>
            ) : (
              <div className="bd-print-continuation-experiences">
                <PrintableExperienceList experiences={page.experiences} references={references} />
              </div>
            )}
            <PrintablePageFooter />
          </main>
        </section>
      ))}
    </div>
  );
}

function PrintablePageFooter() {
  return (
    <footer className="bd-print-page-footer">
      This CV is generated from verified BlueDeck profile data and can be updated from any device.
    </footer>
  );
}

function PrintableHero({ profile, crewName, primaryPosition }: { profile: CrewProfile; crewName: string; primaryPosition: string }) {
  const profilePhotoSource = profile.profile_photo_url
    ? cvImageRequestSource(profile.profile_photo_url, { width: 720, height: 720, fit: "cover" })
    : "";

  return (
    <header className="bd-print-hero">
      <div className="bd-print-hero-band">
        <div
          className="bd-print-avatar"
          style={profilePhotoSource ? { backgroundImage: `url("${profilePhotoSource}")` } : undefined}
        >
          {profilePhotoSource ? (
            <img src={profilePhotoSource} alt={profile.full_name || "Profile"} loading="eager" decoding="sync" />
          ) : (
            <UserRound />
          )}
        </div>
        <div className="bd-print-hero-text">
          <p>Verified Crew Profile</p>
          <h1 style={crewNameStyle(crewName)}>{crewName}</h1>
          <h2>{primaryPosition}</h2>
        </div>
      </div>
    </header>
  );
}

function PrintablePrimarySidebar({
  profile,
  documents,
  visibleSkills,
}: {
  profile: CrewProfile;
  documents: CrewDocument[];
  visibleSkills: string[];
}) {
  return (
    <div className="bd-print-sidebar-stack bd-print-primary-sidebar-stack">
      <div className="bd-print-sidebar-brand">
        <img className="bd-print-brand-logo" src="/bluedeck-logo-mark.png" alt="BlueDeck" loading="eager" decoding="sync" />
        <div>
          <p>BlueDeck.app</p>
          <span>YACHT-OS</span>
        </div>
      </div>

      <PrintableSideSection title="Profile">
        <PrintableSideLine label="Date of Birth" value={formatCvDate(profile.date_of_birth)} />
        <PrintableSideLine label="Nationality" value={profile.nationality || "-"} />
        <PrintableSideLine label="Gender" value={profile.gender || "-"} />
        <PrintableSideLine label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : "-"} />
        <PrintableSideLine label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : "-"} />
        <PrintableSideLine label="Smoker" value={profile.smoker || "-"} />
        <PrintableSideLine label="Visible tattoos" value={profile.visible_tattoos || "-"} />
      </PrintableSideSection>

      <PrintableSideSection title="Contact">
        <PrintableContactLine icon={<Phone />} value={profile.phone || "-"} />
        <PrintableContactLine icon={<Mail />} value={profile.email || "-"} />
        <PrintableContactLine icon={<MapPin />} value={profile.location || "-"} />
      </PrintableSideSection>

      <PrintableSideSection title="Language">
        {(profile.languages || []).slice(0, 4).map((language) => (
          <div className="bd-print-language" key={language.name}>
            <div><b>{language.name}</b><span>{language.level}</span></div>
            <i><span style={{ width: languageLevelWidth(language.level) }} /></i>
          </div>
        ))}
      </PrintableSideSection>

      <PrintableSideSection title="Skills & Characteristics">
        <PrintablePills items={visibleSkills.slice(0, 10)} />
      </PrintableSideSection>

      <PrintableSideSection title="Preferences">
        <PrintablePills items={(profile.work_preferences || []).slice(0, 5)} />
      </PrintableSideSection>

      {documents.length > 0 && (
        <p className="bd-print-doc-hint">{documents.length} documents continue on the next page.</p>
      )}
    </div>
  );
}

function PrintableDocumentSidebar({ profile, documents }: { profile: CrewProfile; documents: CrewDocument[] }) {
  return (
    <div className="bd-print-sidebar-stack bd-print-document-sidebar-stack">
      <PrintableSideSection title="Documents & Certificates">
        {documents.slice(0, maxCvDocuments).map((document) => (
          <PrintableDocumentRow key={document.id || document.document_type} document={document} />
        ))}
      </PrintableSideSection>
      <div className="bd-print-qr">
        <PrintableCrewProfileQr crewId={profile.public_crew_id} />
        <p>{profile.public_crew_id || "Crew ID"}</p>
        <b>Photo Gallery</b>
        <span>Scan to view verified yacht work photos on BlueDeck.</span>
      </div>
    </div>
  );
}

function PrintableContinuationSidebar({ profile }: { profile: CrewProfile }) {
  return <div className="bd-print-continuation" aria-label={profile.full_name || "BlueDeck Crew"} />;
}

function PrintableSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <section className="bd-print-section">
      <div className="bd-print-section-title">
        <h3>{title}</h3>
        {badge && <span>{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function PrintableSideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bd-print-side-section">
      <div><h3>{title}</h3><span /></div>
      {children}
    </section>
  );
}

function PrintableSideLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="bd-print-side-line">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function PrintableContactLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="bd-print-contact-line">
      <i>{icon}</i>
      <span>{value}</span>
    </div>
  );
}

function PrintablePills({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="bd-print-empty">-</p>;
  return (
    <div className="bd-print-pills">
      {items.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
    </div>
  );
}

function PrintableExperienceList({ experiences, references }: { experiences: Experience[]; references: ReferenceEntry[] }) {
  if (experiences.length === 0) {
    return <p className="bd-print-empty-card">No yacht experience added yet.</p>;
  }

  return (
    <div className={`bd-print-experience-list bd-print-experience-list-${Math.min(experiences.length, 4)}`}>
      {experiences.map((experience, index) => (
        <div className="bd-print-experience-item" key={experience.id || `${experience.yacht_name}-${experience.start_date}`}>
          {isOtherWorkExperience(experience) && !isOtherWorkExperience(experiences[index - 1] || emptyExperience) && (
            <p className="bd-print-subsection-label">Other Work Experience</p>
          )}
          <PrintableExperienceCard
            experience={experience}
            references={cvReferencesForExperience(experience, references)}
          />
        </div>
      ))}
    </div>
  );
}

function PrintableExperienceCard({ experience, references }: { experience: Experience; references: ReferenceEntry[] }) {
  const yachtName = displayExperienceTitle(experience);
  const metaParts = displayExperienceMetaParts(experience);
  const isOtherWork = isOtherWorkExperience(experience);

  return (
    <article className="bd-print-experience-card">
      <div className="bd-print-experience-meta">
        {experience.photo_url ? (
          <img src={experience.photo_url} alt={yachtName} loading="eager" decoding="sync" />
        ) : (
          <div className="bd-print-experience-placeholder">{isOtherWork ? <BriefcaseBusiness /> : null}</div>
        )}
        <b style={{ fontSize: yachtNameFontSize(yachtName) }}>{yachtName}</b>
        {metaParts.length > 0 && <span>{metaParts.join(" / ")}</span>}
        <em>{formatDateRange(experience.start_date, experience.end_date)}</em>
        {experience.location && <small><MapPin /> {experience.location}</small>}
      </div>
      <div className="bd-print-experience-body">
        <div className="bd-print-experience-top">
          <h4 style={{ fontSize: yachtNameFontSize(yachtName) }}>{yachtName}</h4>
          <span>{experience.position || "Position"}</span>
        </div>
        <p className="bd-print-label">Duties</p>
        <p className="bd-print-duties">{experience.description || "Responsibilities and onboard duties will appear here."}</p>
        {references.length > 0 && (
          <div className="bd-print-reference-block">
            <p className="bd-print-label">Reference</p>
            {references.slice(0, 2).map((reference) => (
              <div className="bd-print-reference-card" key={reference.id || reference.email || reference.phone || reference.name}>
                <b>{referenceDisplayName(reference)}</b>
                <span>{referenceDetailText(reference)}</span>
                {referenceContactText(reference) && <em>{referenceContactText(reference)}</em>}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function PrintableDocumentRow({ document }: { document: CrewDocument }) {
  const subtitle = documentSubtitle(document);
  return (
    <div className="bd-print-document-row">
      <b>{document.document_type || "Document"}</b>
      <span>{document.expiry_date ? formatCvDate(document.expiry_date) : "No expiry"}</span>
      {subtitle && <em>{subtitle}</em>}
    </div>
  );
}

function SeazoneSection({
  title,
  badge,
  children,
  className = "mt-6",
}: {
  title: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bd-cv-section ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-[#b9c8cd] pb-2">
        <h3 className="text-[13px] font-black uppercase tracking-[0.14em] text-[#06111f]">{title}</h3>
        {badge && <span className="rounded-full bg-[#173f4a] px-3 py-1 text-[11px] font-black text-white shadow-sm shadow-[#173f4a]/20">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function SeazoneSideSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bd-cv-side-section ${className}`}>
      <div className="mb-3 flex items-center gap-4">
        <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#242a31]">{title}</h3>
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
        <p className="mt-0.5 text-[10px] font-bold uppercase leading-3 tracking-[0.16em] text-[#59666d]">YACHT-OS</p>
      </div>
    </div>
  );
}

function SeazoneContactLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="grid grid-cols-[20px_1fr] items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[#173f4a] text-white shadow-sm shadow-[#173f4a]/15">
        {icon}
      </span>
      <p className="min-w-0 break-words leading-6">{value}</p>
    </div>
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

function SeazoneExperienceCard({
  experience,
  references,
  breakBefore = false,
}: {
  experience: Experience;
  references: ReferenceEntry[];
  breakBefore?: boolean;
}) {
  const yachtName = displayExperienceTitle(experience);
  const metaParts = displayExperienceMetaParts(experience);
  const isOtherWork = isOtherWorkExperience(experience);

  return (
    <article className={`bd-cv-experience rounded-2xl border border-[#d8e2e6] bg-white p-3 shadow-sm shadow-slate-950/5 ${breakBefore ? "bd-cv-experience-break-before" : ""}`}>
      <div className="bd-cv-experience-grid grid items-stretch gap-3 sm:grid-cols-[136px_1fr]">
        <div className="bd-cv-experience-meta h-full rounded-xl border border-[#cbd8dd] bg-[#f8fbfc] p-2">
          {experience.photo_url ? (
            <img src={experience.photo_url} alt={yachtName} className="h-24 w-full rounded-lg object-cover" />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#f5f8f9,#e8f0f2)] text-[#2d7482]">
              {isOtherWork ? <BriefcaseBusiness className="h-7 w-7" /> : <Camera className="h-6 w-6 opacity-45" />}
            </div>
          )}
          <div className="mt-3">
            {metaParts.length > 0 && (
              <p className="mt-1 text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-[#6b747a]">
                {metaParts.join(" / ")}
              </p>
            )}
            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#2d7482]">{formatDateRange(experience.start_date, experience.end_date)}</p>
            {experience.location && (
              <p className="mt-1 flex items-start gap-1.5 text-[10px] font-black uppercase leading-4 tracking-[0.06em] text-[#2d7482]">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{experience.location}</span>
              </p>
            )}
          </div>
        </div>

        <div className="bd-cv-experience-body h-full rounded-xl border border-[#b8c9d0] bg-white p-3">
            <div className="bd-cv-experience-titlebar mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#d8e2e6] bg-white px-3 py-2">
              <h4 className="min-w-0 truncate font-black uppercase leading-[1.05] text-[#06111f]" style={{ fontSize: yachtNameFontSize(yachtName) }}>{yachtName}</h4>
              <span className="inline-flex shrink-0 rounded-md bg-[#173f4a] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                {experience.position || "Position"}
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b7b84]">Duties</p>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[#17232c]">
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
    <div className="bd-cv-reference-list mt-3 border-t border-[#c7d2d6] pt-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2d7482]">Reference</p>
      <div className="mt-2 grid gap-2">
        {references.slice(0, 2).map((reference) => (
          <div key={reference.id || reference.email || reference.phone || reference.name} className="bd-cv-reference-card rounded-lg border border-[#d8e2e6] bg-white px-3 py-2">
            <p className="text-[13px] font-black text-[#06111f]">{referenceDisplayName(reference)}</p>
            <p className="mt-1 text-xs font-semibold text-[#2d7482]">
              {referenceDetailText(reference)}
            </p>
            {referenceContactText(reference) && <p className="mt-1 text-xs text-[#5a6870]">{referenceContactText(reference)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SeazoneDocumentRow({ document }: { document: CrewDocument }) {
  const expiring = !document.no_expiry && isWithin90Days(document.expiry_date);
  const subtitle = documentSubtitle(document);
  return (
    <div className={`bd-cv-document-row rounded-lg border px-2.5 py-1.5 ${expiring ? "border-[#d8b4a0] bg-[#fff7f3]" : "border-[#c7d2d6] bg-[#f6f8f8]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black leading-3 text-[#06111f]">{document.document_type || "Document"}</p>
          {subtitle && <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-[0.08em] text-[#7a858b]">{subtitle}</p>}
        </div>
        <p className={`shrink-0 text-right text-[9px] font-black leading-3 ${expiring ? "text-[#9a4b2e]" : "text-[#2d7482]"}`}>
          {document.no_expiry ? "No expiry" : formatCvDate(document.expiry_date)}
        </p>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  action,
  active = true,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  active?: boolean;
}) {
  if (!active) return null;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-cyan-100 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="h-1 bg-[linear-gradient(90deg,#07111f,#0891b2,#2d7482)]" />
      <div className="p-3 sm:p-4">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0e7490,#67e8f9)] text-white shadow-lg shadow-cyan-900/15">{icon}</div>
            <h2 className="truncate text-base font-semibold text-slate-950">{title}</h2>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="min-w-0 space-y-3.5">{children}</div>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openFilePicker() {
    if (!uploading) fileInputRef.current?.click();
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 py-1 sm:flex-row sm:items-center sm:gap-4">
      <div
        className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"
        aria-busy={uploading}
      >
        {url && (
          <img
            src={url}
            alt={`${name || "User"} profile photo`}
            className="h-full w-full object-cover transition duration-200 pointer-fine:group-hover:scale-[1.02] pointer-fine:group-hover:brightness-75 pointer-fine:group-hover:blur-[1px] group-focus-within:scale-[1.02] group-focus-within:brightness-75 group-focus-within:blur-[1px]"
          />
        )}

        {!url && !uploading && (
          <button
            type="button"
            onClick={openFilePicker}
            aria-label="Add profile photo"
            title="Add profile photo"
            className="absolute inset-0 flex cursor-pointer items-center justify-center text-cyan-800 transition hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-200 bg-white shadow-sm transition group-hover:scale-105 group-hover:border-cyan-300">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
          </button>
        )}

        {url && !uploading && (
          <>
            <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-slate-950/35 opacity-0 backdrop-blur-[1px] transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 pointer-fine:flex">
              <button
                type="button"
                onClick={openFilePicker}
                aria-label="Change profile photo"
                title="Change profile photo"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-cyan-800 shadow-lg">
                  <Camera className="h-4 w-4" aria-hidden />
                </span>
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove profile photo"
                title="Remove profile photo"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition hover:bg-rose-100/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-lg">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent px-0.5 pb-1 pt-4 pointer-fine:hidden">
              <button
                type="button"
                onClick={openFilePicker}
                aria-label="Change profile photo"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-cyan-800 shadow-md">
                  <Camera className="h-4 w-4" aria-hidden />
                </span>
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove profile photo"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-md">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </div>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/80 text-cyan-800 backdrop-blur-[2px]">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
            <button
              type="button"
              onClick={onCancelUpload}
              aria-label="Cancel profile photo upload"
              title="Cancel upload"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-600 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Choose profile photo"
          disabled={uploading}
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onUpload(file);
          }}
        />
        <span className="sr-only" role="status" aria-live="polite">{uploading ? "Uploading profile photo..." : ""}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-950">Profile photo</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{uploading ? "Uploading photo..." : "This appears in your portal and CV."}</p>
      </div>
    </div>
  );
}

function DropdownChoiceGroup({
  title,
  options,
  value,
  onChange,
  selectedAsTitle = false,
  singleSelect = false,
  maxSelected,
  selectedPanel = false,
  inlineSelected = false,
  commitOnSelect = false,
  compact = false,
  profileField = false,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  selectedAsTitle?: boolean;
  singleSelect?: boolean;
  maxSelected?: number;
  selectedPanel?: boolean;
  inlineSelected?: boolean;
  commitOnSelect?: boolean;
  compact?: boolean;
  profileField?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const displayValue = singleSelect ? value.slice(0, 1) : value;
  const [draft, setDraft] = useState(displayValue);
  const hasSelection = displayValue.length > 0;
  const selectedText = hasSelection ? displayValue.join(", ") : "Select";
  const triggerTitle = selectedAsTitle ? (hasSelection ? selectedText : profileField ? "Select" : title) : title;
  const triggerMeta = selectedAsTitle ? (hasSelection ? "Change" : profileField ? "" : selectedText) : selectedPanel || inlineSelected ? `${displayValue.length}${maxSelected ? `/${maxSelected}` : ""} selected` : selectedText;

  useEffect(() => {
    setDraft(displayValue);
  }, [value]);

  function setGroupOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function updateSelection(option: string) {
    const selected = draft.includes(option);

    if (singleSelect) {
      onChange([option]);
      setDraft([option]);
      setGroupOpen(false);
      return;
    }

    if (!selected && maxSelected && draft.length >= maxSelected) return;

    const nextDraft = selected ? draft.filter((item) => item !== option) : [...draft, option];
    setDraft(nextDraft);
    if (commitOnSelect) onChange(nextDraft);
    if (!selected && maxSelected && nextDraft.length >= maxSelected) setGroupOpen(false);
  }

  function removeSelection(item: string) {
    const nextValue = displayValue.filter((selected) => selected !== item);
    setDraft(nextValue);
    onChange(nextValue);
  }

  return (
    <div className={compact ? "py-3.5 first:pt-0 last:pb-0" : ""}>
      <div className={selectedPanel ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]" : ""}>
        <button
          type="button"
          aria-label={title}
          aria-expanded={open}
          onClick={() => {
            setDraft(displayValue);
            setGroupOpen(!open);
          }}
          className={compact
            ? "bd-focus flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            : profileField
              ? `${profileFieldControlClassName} flex items-center justify-between gap-3 text-left`
              : "flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm"}
        >
          <span className="min-w-0 truncate">{triggerTitle}</span>
          {compact ? (
            <span className="ml-3 flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{triggerMeta}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
            </span>
          ) : triggerMeta ? (
            <span className="ml-3 shrink-0 text-right text-xs text-cyan-700">{triggerMeta}</span>
          ) : null}
        </button>

        {selectedPanel && (
          <div className="rounded-xl border border-cyan-100 bg-[#f8fcfd] p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#2d7482]">Selected</p>
              <p className="text-[10px] font-black text-slate-500">{displayValue.length}{maxSelected ? ` / ${maxSelected}` : ""}</p>
            </div>
            {displayValue.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400">Nothing selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displayValue.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => removeSelection(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-100 bg-white px-2 py-1 text-[11px] font-black text-[#173f4a] shadow-sm transition hover:border-rose-200 hover:text-rose-700"
                    title={`Remove ${item}`}
                  >
                    {item}
                    <span aria-hidden="true" className="text-xs leading-none">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {inlineSelected && (
        compact ? (
          displayValue.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1.5 px-2 pb-1">
              {displayValue.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => removeSelection(item)}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-[#173f4a] transition hover:bg-rose-50 hover:text-rose-700"
                  title={`Remove ${item}`}
                >
                  {item}
                  <span aria-hidden="true" className="text-xs leading-none">×</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="mt-2 rounded-xl border border-cyan-100 bg-[#f8fcfd] p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#2d7482]">{title}</p>
              <p className="text-[10px] font-black text-slate-500">{displayValue.length}{maxSelected ? ` / ${maxSelected}` : ""}</p>
            </div>
            {displayValue.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400">Nothing selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displayValue.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => removeSelection(item)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-cyan-100 bg-white px-2 py-1 text-[11px] font-black text-[#173f4a] shadow-sm transition hover:border-rose-200 hover:text-rose-700"
                    title={`Remove ${item}`}
                  >
                    {item}
                    <span aria-hidden="true" className="text-xs leading-none">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}
      {displayValue.length > 0 && !selectedAsTitle && !selectedPanel && !inlineSelected && <PillList items={displayValue} light />}
      {open && (
        <div className={compact
          ? "mt-2 max-h-[min(55vh,28rem)] overflow-y-auto overscroll-contain rounded-xl bg-slate-50 p-2.5"
          : "mt-3 rounded-2xl border border-slate-200 bg-[#fbfaf7] p-3"}>
          <div className={compact ? "grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-3" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"}>
            {options.map((option) => {
              const selected = draft.includes(option);
              const locked = !selected && Boolean(maxSelected && draft.length >= maxSelected);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={locked}
                  onClick={() => updateSelection(option)}
                  className={`${compact ? "min-h-11 rounded-lg px-2.5 py-2 text-xs sm:text-sm" : "rounded-xl px-3 py-2 text-sm"} border text-left font-semibold transition ${
                    selected
                      ? "border-cyan-600 bg-cyan-600 text-white"
                      : locked
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-cyan-400"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {maxSelected && <p className={`mt-3 text-xs font-semibold text-slate-500 ${compact ? "px-1" : ""}`}>Maximum {maxSelected} selections.</p>}
          {!singleSelect && !commitOnSelect && <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft(displayValue);
                setGroupOpen(false);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setGroupOpen(false);
              }}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>}
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

function DocumentCard({ document, onChange, onDelete }: { document: CrewDocument; onChange: (document: CrewDocument) => Promise<boolean>; onDelete: (id?: string) => void }) {
  const [draft, setDraft] = useState(document);
  const [savedDocument, setSavedDocument] = useState(document);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorContentId = useId();
  const alert = !draft.no_expiry && isWithin90Days(draft.expiry_date);
  const dirty = !saveStateEquals(documentSaveState(draft), documentSaveState(savedDocument));
  const saved = !dirty;
  const catalogDocument = documentCatalog.some((group) => group.items.includes(draft.document_type));
  const summaryExpiry = draft.no_expiry ? "No expiry" : draft.expiry_date ? formatCvDate(draft.expiry_date) : "Expiry not set";

  async function handleSave() {
    if (saved || saving) return;
    setSaving(true);
    try {
      const ok = await onChange(draft);
      if (ok) setSavedDocument(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm shadow-slate-900/5 ${alert ? "border-amber-300" : "border-slate-200"}`}>
      <button
        type="button"
        onClick={() => setEditorOpen((open) => !open)}
        aria-expanded={editorOpen}
        aria-controls={editorContentId}
        className={`bd-focus grid min-h-16 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition sm:px-4 ${alert ? "bg-amber-50/70 hover:bg-amber-50" : "hover:bg-slate-50"}`}
      >
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${alert ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-cyan-800"}`}>
          <IdCard className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-slate-950">
            {draft.document_type ? (catalogDocument ? draft.document_type : <span data-i18n-ignore>{draft.document_type}</span>) : "Document"}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-slate-500">
            {draft.issuer ? <span data-i18n-ignore className="truncate">{draft.issuer}</span> : <span className="truncate">{draft.category || "General"}</span>}
            <span aria-hidden>·</span>
            {draft.expiry_date ? <span data-i18n-ignore className="shrink-0">{summaryExpiry}</span> : <span className="shrink-0">{summaryExpiry}</span>}
            {draft.show_on_cv && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800">
                <Check className="h-3 w-3" aria-hidden />
                <span data-i18n-ignore aria-hidden>CV</span>
                <span className="sr-only">Show on CV</span>
              </span>
            )}
          </span>
        </span>
        <span className="flex items-center gap-2 text-cyan-800">
          {alert && (
            <span className="text-amber-700">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <span className="sr-only">Expiry alert: update this document soon.</span>
            </span>
          )}
          {dirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Unsaved</span>}
          <span className="sr-only">{editorOpen ? "Hide details" : "View details"}</span>
          <span aria-hidden className="hidden text-xs font-semibold sm:inline">{editorOpen ? "Hide details" : "View details"}</span>
          <ChevronDown className={`h-5 w-5 shrink-0 transition ${editorOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      <div id={editorContentId} hidden={!editorOpen} className="border-t border-slate-200 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <DateField label="Expiry" value={draft.expiry_date} disabled={draft.no_expiry || saving} mobileFriendly onChange={(value) => setDraft({ ...draft, expiry_date: value })} />
          <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 [&>label]:min-h-11 [&>label]:w-full">
            <Checkbox label="No expiry" checked={draft.no_expiry} disabled={saving} onChange={(checked) => setDraft({ ...draft, no_expiry: checked, expiry_date: checked ? "" : draft.expiry_date })} />
          </div>
          <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 [&>label]:min-h-11 [&>label]:w-full">
            <Checkbox label="Show on CV" checked={draft.show_on_cv} disabled={saving} onChange={(checked) => setDraft({ ...draft, show_on_cv: checked })} />
          </div>
        </div>

        {alert && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Expiry alert: update this document soon.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving || saved}
            onClick={handleSave}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-default sm:w-auto ${
              saved
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "cursor-pointer bg-cyan-400 text-[#020817] hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
            }`}
          >
            {saving ? <Plus className="h-4 w-4" /> : saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span aria-live="polite">{saving ? "Saving" : saved ? "Saved" : "Save"}</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onDelete(draft.id)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </button>
        </div>
      </div>
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
  onDirtyChange,
}: {
  item: Experience;
  isNew: boolean;
  references: ReferenceEntry[];
  referenceSaving: boolean;
  onSave: (item: Experience) => Promise<boolean>;
  onDelete: (id?: string) => void;
  onSaveReference: (item: ReferenceEntry) => Promise<boolean>;
  onDeleteReference: (id?: string) => void;
  onUpload: (file: File) => Promise<string>;
  onCancelUpload: () => void;
  uploading: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(item);
  const [editorOpen, setEditorOpen] = useState(isNew);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const editorContentId = useId();
  const referencesId = useId();
  const dutiesId = useId();
  const photoInputId = useId();
  const dirty = !saveStateEquals(experienceSaveState(draft), experienceSaveState(item));
  const dutiesValue = (draft.description || "").slice(0, yachtDutiesMaxLength);
  const dutiesLength = dutiesValue.length;
  const summaryDate = [
    draft.start_date ? formatCvDate(draft.start_date) : "",
    draft.end_date ? formatCvDate(draft.end_date) : "",
  ].filter(Boolean).join(" – ");
  const summaryOngoing = Boolean(draft.start_date && !draft.end_date);
  const hasSummaryMeta = Boolean(draft.position || summaryDate);
  const linkedReferenceCount = draft.yacht_name.trim()
    ? references.filter((reference) => referenceMatchesTargetName(reference, draft.yacht_name.trim())).length
    : 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function removePhoto() {
    setDraft({ ...draft, photo_url: "" });
  }

  return (
    <article className={isNew ? "min-w-0" : "min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5"}>
      {!isNew && (
        <button
          type="button"
          onClick={() => setEditorOpen((open) => !open)}
          aria-expanded={editorOpen}
          aria-controls={editorContentId}
          className="bd-focus grid min-h-16 w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 sm:px-4"
        >
          <span className="flex h-12 w-12 overflow-hidden rounded-xl bg-slate-100 text-slate-400">
            {draft.photo_url ? (
              <img src={draft.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Camera className="h-5 w-5" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-slate-950">
              {draft.yacht_name ? <span data-i18n-ignore>{draft.yacht_name}</span> : "Yacht"}
            </span>
            {hasSummaryMeta ? (
              <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
                {draft.position && <span className="truncate">{draft.position}</span>}
                {draft.position && summaryDate && <span aria-hidden>·</span>}
                {summaryDate && <span data-i18n-ignore className="shrink-0">{summaryDate}</span>}
                {summaryOngoing && <span aria-hidden>–</span>}
                {summaryOngoing && <span className="shrink-0">Present</span>}
              </span>
            ) : (
              <span aria-hidden className="mt-0.5 block text-xs text-slate-500">View details</span>
            )}
          </span>
          <span className="flex items-center gap-2 text-cyan-800">
            {dirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Unsaved</span>}
            <span className="sr-only">{editorOpen ? "Hide details" : "View details"}</span>
            <span aria-hidden className="hidden text-xs font-semibold sm:inline">{editorOpen ? "Hide details" : "View details"}</span>
            <ChevronDown className={`h-5 w-5 shrink-0 transition ${editorOpen ? "rotate-180" : ""}`} />
          </span>
        </button>
      )}

      <div
        id={editorContentId}
        hidden={!isNew && !editorOpen}
        className={`${isNew ? "mx-auto max-w-3xl" : "border-t border-slate-200 p-4 sm:p-5"}`}
      >
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Yacht details</legend>

          <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-xl bg-slate-50/80 p-3 min-[380px]:grid-cols-[96px_minmax(0,1fr)]">
          <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 min-[380px]:h-20 min-[380px]:w-24">
            {draft.photo_url ? (
              <img src={draft.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Camera className="h-6 w-6" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Photo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id={photoInputId}
                type="file"
                accept="image/*"
                disabled={uploading}
                className="peer sr-only"
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  const url = await onUpload(file);
                  if (url) setDraft((current) => ({ ...current, photo_url: url }));
                }}
              />
              <label htmlFor={photoInputId} className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 peer-focus-visible:ring-offset-2 ${uploading ? "cursor-progress opacity-70" : ""}`}>
                <Upload className="h-4 w-4" />
                <span aria-live="polite">{uploading ? "Uploading..." : draft.photo_url ? "Change photo" : "Add photo"}</span>
              </label>
              {uploading && (
                <button type="button" onClick={onCancelUpload} className="min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
                  Cancel
                </button>
              )}
              {draft.photo_url && !uploading && (
                <button type="button" onClick={removePhoto} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ExperienceCardInput
            label="Yacht name"
            value={draft.yacht_name}
            placeholder="Yacht name"
            strong
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, yacht_name: value })}
          />
          <ExperienceCardSelect
            label="Position"
            value={draft.position}
            options={yachtPositionTitles}
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, position: value })}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <ExperienceCardDateField label="Start date" value={draft.start_date} mobileFriendly onChange={(value) => setDraft({ ...draft, start_date: value })} />
          <ExperienceCardDateField label="End date" value={draft.end_date} mobileFriendly onChange={(value) => setDraft({ ...draft, end_date: value })} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ExperienceCardSelect
            label="Yacht type"
            value={draft.yacht_type || ""}
            options={yachtTypeOptions}
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, yacht_type: value })}
          />
          <ExperienceCardSelect
            label="Yacht program"
            value={draft.yacht_program || ""}
            options={yachtProgramOptions}
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, yacht_program: value })}
          />
          <ExperienceSizeField
            value={draft.yacht_size || ""}
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, yacht_size: value })}
          />
          <ExperienceCardInput
            label="Location"
            value={draft.location}
            placeholder="Location"
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, location: capitalizeFirstCharacter(value) })}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={dutiesId} className="text-xs font-semibold text-slate-700">Duties</label>
            <span data-i18n-ignore className="text-xs font-medium tabular-nums text-slate-400">
              {dutiesLength}/{yachtDutiesMaxLength}
            </span>
          </div>
          <textarea
            id={dutiesId}
            value={dutiesValue}
            maxLength={yachtDutiesMaxLength}
            onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, yachtDutiesMaxLength) })}
            placeholder="Responsibilities and onboard duties"
            className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 sm:text-sm"
          />
        </div>

        </fieldset>

        <section className="mt-5 border-t border-slate-200 pt-2">
          <button
            type="button"
            onClick={() => setReferencesOpen((open) => !open)}
            aria-expanded={referencesOpen}
            aria-controls={referencesId}
            className="bd-focus grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-3 text-left transition hover:bg-slate-50 sm:px-2"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">References</span>
              <span className="mt-0.5 block text-xs text-slate-500">Add contact details only when needed</span>
            </span>
            <span className="flex items-center gap-2 text-slate-500">
              <span className={`rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold ${linkedReferenceCount > 0 ? "inline-flex" : "hidden sm:inline-flex"}`}>
                {linkedReferenceCount > 0 ? <span data-i18n-ignore>{linkedReferenceCount}</span> : "Optional"}
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 transition ${referencesOpen ? "rotate-180 text-cyan-700" : ""}`} />
            </span>
          </button>
          <div id={referencesId} hidden={!referencesOpen} className="mt-1 rounded-xl bg-slate-50/70 p-3.5 [&_.experience-reference-phone]:h-11 [&_button]:min-h-11 [&_button]:text-sm [&_button]:font-semibold [&_button]:normal-case [&_button]:tracking-normal [&_input]:min-h-11 [&_input]:text-base [&_p]:text-xs [&_p]:font-semibold [&_p]:normal-case [&_p]:tracking-normal sm:p-4 sm:[&_input]:text-sm">
            <LinkedReferencePanel
              targetName={draft.yacht_name}
              targetKind="yacht"
              references={references}
              referenceSaving={referenceSaving}
              onSaveReference={onSaveReference}
              onDeleteReference={onDeleteReference}
              embedded
            />
          </div>
        </section>

        <EditorButtons isNew={isNew} dirty={dirty} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Add experience" mobileWide />
      </div>
    </article>
  );
}

function OtherWorkExperienceEditor({
  item,
  isNew,
  references,
  referenceSaving,
  onSave,
  onDelete,
  onSaveReference,
  onDeleteReference,
  onDirtyChange,
}: {
  item: Experience;
  isNew: boolean;
  references: ReferenceEntry[];
  referenceSaving: boolean;
  onSave: (item: Experience) => Promise<boolean>;
  onDelete: (id?: string) => void;
  onSaveReference: (item: ReferenceEntry) => Promise<boolean>;
  onDeleteReference: (id?: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(normalizeOtherWorkExperience(item));
  const [editorOpen, setEditorOpen] = useState(isNew);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const editorContentId = useId();
  const referencesId = useId();
  const dutiesId = useId();
  const normalizedDraft = normalizeOtherWorkExperience(draft);
  const dirty = !saveStateEquals(experienceSaveState(normalizedDraft), experienceSaveState(normalizeOtherWorkExperience(item)));
  const dutiesValue = (draft.description || "").slice(0, yachtDutiesMaxLength);
  const dutiesLength = dutiesValue.length;
  const summaryDate = [
    draft.start_date ? formatCvDate(draft.start_date) : "",
    draft.end_date ? formatCvDate(draft.end_date) : "",
  ].filter(Boolean).join(" – ");
  const summaryOngoing = Boolean(draft.start_date && !draft.end_date);
  const hasSummaryMeta = Boolean(draft.position || summaryDate);
  const linkedReferenceCount = draft.yacht_name.trim()
    ? references.filter((reference) => referenceMatchesTargetName(reference, draft.yacht_name.trim())).length
    : 0;

  useEffect(() => {
    setDraft(normalizeOtherWorkExperience(item));
  }, [item]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  return (
    <article className={isNew ? "min-w-0" : "min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5"}>
      {!isNew && (
        <button
          type="button"
          onClick={() => setEditorOpen((open) => !open)}
          aria-expanded={editorOpen}
          aria-controls={editorContentId}
          className="bd-focus grid min-h-16 w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 sm:px-4"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-slate-950">
              {draft.yacht_name ? <span data-i18n-ignore>{draft.yacht_name}</span> : "Workplace / company"}
            </span>
            {hasSummaryMeta ? (
              <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
                {draft.position && <span data-i18n-ignore className="truncate">{draft.position}</span>}
                {draft.position && summaryDate && <span aria-hidden>·</span>}
                {summaryDate && <span data-i18n-ignore className="shrink-0">{summaryDate}</span>}
                {summaryOngoing && <span aria-hidden>–</span>}
                {summaryOngoing && <span className="shrink-0">Present</span>}
              </span>
            ) : (
              <span aria-hidden className="mt-0.5 block text-xs text-slate-500">View details</span>
            )}
          </span>
          <span className="flex items-center gap-2 text-cyan-800">
            {dirty && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Unsaved</span>}
            <span className="sr-only">{editorOpen ? "Hide details" : "View details"}</span>
            <span aria-hidden className="hidden text-xs font-semibold sm:inline">{editorOpen ? "Hide details" : "View details"}</span>
            <ChevronDown className={`h-5 w-5 shrink-0 transition ${editorOpen ? "rotate-180" : ""}`} />
          </span>
        </button>
      )}

      <div
        id={editorContentId}
        hidden={!isNew && !editorOpen}
        className={`${isNew ? "mx-auto max-w-3xl" : "border-t border-slate-200 p-4 sm:p-5"}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ExperienceCardInput
            label="Workplace / company"
            value={draft.yacht_name}
            placeholder="Workplace / company"
            strong
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, yacht_name: capitalizeFirstCharacter(value) })}
          />
          <ExperienceCardInput
            label="Position"
            value={draft.position}
            placeholder="Position"
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, position: capitalizeFirstCharacter(value) })}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <ExperienceCardDateField label="Start date" value={draft.start_date} mobileFriendly onChange={(value) => setDraft({ ...draft, start_date: value })} />
          <ExperienceCardDateField label="End date" value={draft.end_date} mobileFriendly onChange={(value) => setDraft({ ...draft, end_date: value })} />
        </div>

        <div className="mt-4">
          <ExperienceCardInput
            label="Location"
            value={draft.location}
            placeholder="Location"
            mobileFriendly
            onChange={(value) => setDraft({ ...draft, location: capitalizeFirstCharacter(value) })}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={dutiesId} className="text-xs font-semibold text-slate-700">Duties</label>
            <span data-i18n-ignore className="text-xs font-medium tabular-nums text-slate-400">
              {dutiesLength}/{yachtDutiesMaxLength}
            </span>
          </div>
          <textarea
            id={dutiesId}
            value={dutiesValue}
            maxLength={yachtDutiesMaxLength}
            onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, yachtDutiesMaxLength) })}
            placeholder="Responsibilities, achievements and work duties"
            className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 sm:text-sm"
          />
        </div>

        <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setReferencesOpen((open) => !open)}
            aria-expanded={referencesOpen}
            aria-controls={referencesId}
            className="bd-focus grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 text-left transition hover:bg-slate-50 sm:px-4"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">References</span>
              <span className="mt-0.5 block text-xs text-slate-500">Add contact details only when needed</span>
            </span>
            <span className="flex items-center gap-2 text-slate-500">
              <span className={`rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold ${linkedReferenceCount > 0 ? "inline-flex" : "hidden sm:inline-flex"}`}>
                {linkedReferenceCount > 0 ? <span data-i18n-ignore>{linkedReferenceCount}</span> : "Optional"}
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 transition ${referencesOpen ? "rotate-180 text-cyan-700" : ""}`} />
            </span>
          </button>
          <div id={referencesId} hidden={!referencesOpen} className="border-t border-slate-200 p-3.5 [&_.experience-reference-phone]:h-11 [&_button]:min-h-11 [&_button]:text-sm [&_button]:font-semibold [&_button]:normal-case [&_button]:tracking-normal [&_input]:min-h-11 [&_input]:text-base [&_p]:text-xs [&_p]:font-semibold [&_p]:normal-case [&_p]:tracking-normal sm:p-4 sm:[&_input]:text-sm">
            <LinkedReferencePanel
              targetName={draft.yacht_name}
              targetKind="workplace"
              references={references}
              referenceSaving={referenceSaving}
              onSaveReference={onSaveReference}
              onDeleteReference={onDeleteReference}
              embedded
            />
          </div>
        </section>

        <EditorButtons
          isNew={isNew}
          dirty={dirty}
          onSave={() => onSave(normalizedDraft)}
          onDelete={() => onDelete(draft.id)}
          addLabel="Add work experience"
          mobileWide
        />
      </div>
    </article>
  );
}

function LinkedReferencePanel({
  targetName,
  targetKind,
  references,
  referenceSaving,
  onSaveReference,
  onDeleteReference,
  embedded = false,
}: {
  targetName: string;
  targetKind: "yacht" | "workplace";
  references: ReferenceEntry[];
  referenceSaving: boolean;
  onSaveReference: (item: ReferenceEntry) => Promise<boolean>;
  onDeleteReference: (id?: string) => void;
  embedded?: boolean;
}) {
  const cleanTargetName = targetName.trim();
  const linkedReferences = cleanTargetName ? references.filter((reference) => referenceMatchesTargetName(reference, cleanTargetName)) : [];
  const requestReference = linkedReferences.find(isReferenceUponRequest);
  const regularReferences = linkedReferences.filter((reference) => !isReferenceUponRequest(reference));
  const targetLabel = targetKind === "yacht" ? "yacht name" : "workplace / company";
  const linkedText = targetKind === "yacht" ? "Linked to this yacht" : "Linked to this work";

  async function saveLinkedReference(reference: ReferenceEntry) {
    if (!cleanTargetName) {
      alert(`Add the ${targetLabel} before saving a reference.`);
      return false;
    }

    if (isReferenceUponRequest(reference)) {
      return onSaveReference(referenceUponRequestEntry(cleanTargetName, reference));
    }

    return onSaveReference({
      ...reference,
      name: (reference.name || reference.company).trim(),
      vessel: cleanTargetName,
      company: "",
      notes: "",
      show_on_cv: true,
    });
  }

  return (
    <div className={embedded ? "" : "mt-3 border-t border-[#c7d2d6] pt-3"}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2d7482]">Reference</p>
        <p className="text-[10px] font-semibold text-[#6b7b84]">{linkedText}</p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={referenceSaving || Boolean(requestReference)}
          onClick={() => saveLinkedReference(referenceUponRequestEntry(targetName))}
          className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-[11px] font-black uppercase tracking-[0.06em] transition disabled:cursor-default ${
            requestReference
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-[#b9dce3] bg-white text-[#173f4a] hover:border-[#2d7482] hover:bg-[#eef7f8] disabled:opacity-60"
          }`}
        >
          {requestReference ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {referenceUponRequestText}
        </button>
        {requestReference && (
          <button
            type="button"
            disabled={referenceSaving}
            onClick={() => onDeleteReference(requestReference.id)}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-rose-100 bg-white px-2.5 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Remove references available upon request"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div
        className={`divide-y divide-slate-200 transition ${
          requestReference ? "opacity-55 grayscale-[0.35]" : ""
        }`}
        aria-disabled={Boolean(requestReference)}
      >
        {regularReferences.map((reference) => (
          <ExperienceReferenceEditor
            key={reference.id || `${reference.name}-${reference.email}`}
            item={reference}
            isNew={false}
            saving={referenceSaving}
            disabled={Boolean(requestReference)}
            onSave={saveLinkedReference}
            onDelete={onDeleteReference}
          />
        ))}
        <ExperienceReferenceEditor
          key={`new-reference-${targetKind}`}
          item={emptyReference}
          isNew
          saving={referenceSaving}
          disabled={Boolean(requestReference)}
          onSave={saveLinkedReference}
          onDelete={onDeleteReference}
        />
      </div>
    </div>
  );
}

function ExperienceCardInput({
  label,
  value,
  placeholder,
  onChange,
  strong = false,
  mobileFriendly = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onChange: (value: string) => void;
  strong?: boolean;
  mobileFriendly?: boolean;
}) {
  return (
    <label className="block">
      <span className={mobileFriendly ? "mb-1.5 block text-xs font-semibold text-slate-700" : "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"}>{label}</span>
      <input
        aria-label={label}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full border border-[#d8e2e6] bg-white outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15 ${
          mobileFriendly
            ? `min-h-11 rounded-xl px-3 text-base sm:text-sm ${strong ? "font-semibold text-slate-950" : "font-medium text-slate-800"}`
            : `rounded-lg px-2.5 py-2 ${strong ? "text-[15px] font-semibold leading-tight text-slate-900" : "text-[13px] font-medium text-slate-700"}`
        }`}
      />
    </label>
  );
}

function ExperienceCardSelect({
  label,
  value,
  options,
  onChange,
  mobileFriendly = false,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
  mobileFriendly?: boolean;
}) {
  return (
    <label className="block">
      <span className={mobileFriendly ? "mb-1.5 block text-xs font-semibold text-slate-700" : "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"}>{label}</span>
      <select
        aria-label={label}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full cursor-pointer border border-[#d8e2e6] bg-white font-medium text-slate-700 outline-none transition focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15 ${
          mobileFriendly ? "min-h-11 rounded-xl px-3 text-base sm:text-sm" : "rounded-lg px-2.5 py-2 text-[13px]"
        }`}
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

function ExperienceSizeField({ value, onChange, mobileFriendly = false }: { value?: string; onChange: (value: string) => void; mobileFriendly?: boolean }) {
  const parsed = parseYachtSize(value);
  const [unitDraft, setUnitDraft] = useState<YachtSizeUnit>(parsed.unit);
  const selectedUnit = parsed.amount ? parsed.unit : unitDraft;

  useEffect(() => {
    if (parsed.amount) setUnitDraft(parsed.unit);
  }, [parsed.amount, parsed.unit]);

  function updateAmount(nextAmount: string) {
    onChange(composeYachtSize(nextAmount, selectedUnit));
  }

  function updateUnit(nextUnit: YachtSizeUnit) {
    setUnitDraft(nextUnit);
    onChange(composeYachtSize(parsed.amount, nextUnit));
  }

  return (
    <div className="block">
      <span className={mobileFriendly ? "mb-1.5 block text-xs font-semibold text-slate-700" : "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"}>Yacht size</span>
      <div className={`grid overflow-hidden border border-[#d8e2e6] bg-white transition focus-within:border-[#2d7482] focus-within:ring-2 focus-within:ring-[#2d7482]/15 ${mobileFriendly ? "grid-cols-[1fr_64px] rounded-xl" : "grid-cols-[1fr_58px] rounded-lg"}`}>
        <input
          aria-label="Yacht size"
          inputMode="numeric"
          pattern="[0-9]*"
          value={parsed.amount}
          onChange={(event) => updateAmount(event.target.value.replace(/[^\d]/g, ""))}
          placeholder="Size"
          className={`min-w-0 border-0 bg-white font-medium text-slate-700 outline-none placeholder:text-[#9aa8ae] ${mobileFriendly ? "min-h-11 px-3 text-base sm:text-sm" : "px-2.5 py-2 text-[13px]"}`}
        />
        <select
          aria-label="Yacht size unit"
          value={selectedUnit}
          onChange={(event) => updateUnit(event.target.value as YachtSizeUnit)}
          className={`cursor-pointer border-0 border-l border-[#d8e2e6] bg-slate-50 font-semibold uppercase tracking-[0.06em] text-slate-600 outline-none ${mobileFriendly ? "min-h-11 px-2 text-base sm:text-xs" : "px-1.5 py-2 text-[11px]"}`}
        >
          <option value="ft">ft</option>
          <option value="m">m</option>
        </select>
      </div>
    </div>
  );
}

function ExperienceCardDateField({ label, value, onChange, mobileFriendly = false }: { label: string; value?: string; onChange: (value: string) => void; mobileFriendly?: boolean }) {
  const [display, setDisplay] = useState(formatDateForDisplay(value || ""));

  function commit(nextDisplay: string) {
    const formatted = formatDateTyping(nextDisplay);
    setDisplay(formatted);
    onChange(parseDisplayDate(formatted));
  }

  return (
    <label className="block">
      <span className={mobileFriendly ? "mb-1.5 block text-xs font-semibold text-slate-700" : "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"}>{label}</span>
      <input
        aria-label={label}
        inputMode="numeric"
        value={display}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setDisplay(formatDateForDisplay(parseDisplayDate(display)))}
        placeholder={label}
        className={`w-full border border-[#d8e2e6] bg-white font-medium text-slate-700 outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15 ${mobileFriendly ? "min-h-11 rounded-xl px-3 text-base sm:text-sm" : "rounded-lg px-2.5 py-1.5 text-[13px] leading-5"}`}
      />
    </label>
  );
}

function ExperienceReferenceEditor({
  item,
  isNew,
  saving,
  disabled = false,
  onSave,
  onDelete,
}: {
  item: ReferenceEntry;
  isNew: boolean;
  saving: boolean;
  disabled?: boolean;
  onSave: (item: ReferenceEntry) => Promise<boolean>;
  onDelete: (id?: string) => void;
}) {
  const [draft, setDraft] = useState(item);
  const nameValue = draft.name || draft.company || "";
  const dirty = !saveStateEquals(referenceSaveState({ ...draft, name: nameValue }), referenceSaveState(item));
  const saved = !isNew && !dirty;
  const editorLocked = disabled || saving;

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
    <div className={`py-2.5 transition ${disabled ? "pointer-events-none" : ""}`}>
      <div className="grid items-center gap-2 lg:grid-cols-[1.05fr_0.7fr_1.2fr_1fr_auto]">
        <ReferenceMiniField
          label="Name / Company"
          value={nameValue}
          placeholder="Name / Company"
          disabled={disabled}
          onChange={(value) => setDraft({ ...draft, name: value, company: "" })}
        />
        <ReferenceMiniField
          label="Role"
          value={draft.role}
          placeholder="Role"
          disabled={disabled}
          onChange={(value) => setDraft({ ...draft, role: value })}
        />
        <ReferenceMiniPhoneField
          value={draft.phone}
          disabled={disabled}
          onChange={(value) => setDraft({ ...draft, phone: value })}
        />
        <ReferenceMiniField
          label="Email"
          value={draft.email}
          placeholder="Email"
          type="email"
          disabled={disabled}
          onChange={(value) => setDraft({ ...draft, email: value })}
        />
        <div className="flex gap-1.5 lg:justify-end">
          <button
            type="button"
            disabled={editorLocked || saved}
            onClick={handleSave}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.08em] transition disabled:cursor-default ${
              saved
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "cursor-pointer bg-[#173f4a] text-white hover:bg-[#235866] disabled:cursor-wait disabled:opacity-60"
            }`}
          >
            {saving ? <Plus className="h-3.5 w-3.5" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {saving ? "Saving" : isNew ? "Add" : saved ? "Saved" : "Save"}
          </button>
          {!isNew && (
            <button
              type="button"
              disabled={editorLocked}
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
  disabled = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="block">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-[#d8e2e6] bg-[#f6f8f8] px-2.5 text-[12px] font-semibold text-[#364650] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:bg-white focus:ring-2 focus:ring-[#2d7482]/15 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}

function ReferenceMiniPhoneField({
  value,
  disabled = false,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
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
      <div className="experience-reference-phone flex h-9 overflow-hidden rounded-lg border border-[#d8e2e6] bg-[#f6f8f8] transition focus-within:border-[#2d7482] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2d7482]/15">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen(!open);
            setQuery("");
          }}
          className={`flex w-[74px] shrink-0 cursor-pointer items-center justify-center gap-1 border-r border-[#d8e2e6] bg-white px-1.5 text-[11px] font-black transition hover:bg-[#eef7f8] disabled:cursor-not-allowed ${country ? "text-[#06111f]" : "text-[#9aa8ae]"}`}
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
          disabled={disabled}
          onChange={(event) => onChange(composeReferencePhone(country, event.target.value))}
          inputMode="tel"
          autoComplete="tel"
          placeholder="Phone"
          className="min-w-0 flex-1 bg-transparent px-2 text-[12px] font-semibold text-[#364650] outline-none placeholder:text-[#9aa8ae] disabled:cursor-not-allowed"
        />
      </div>

      {open && !disabled && (
        <div className="bd-auth-popover absolute left-0 top-[calc(100%+6px)] z-50 w-[min(330px,84vw)] overflow-hidden rounded-xl border border-[#d8e2e6] bg-white shadow-2xl shadow-slate-900/18">
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

function EditorButtons({
  isNew,
  dirty = true,
  onSave,
  onDelete,
  addLabel,
  saving = false,
  mobileWide = false,
}: {
  isNew: boolean;
  dirty?: boolean;
  onSave: () => unknown | Promise<unknown>;
  onDelete: () => void;
  addLabel: string;
  saving?: boolean;
  mobileWide?: boolean;
}) {
  const saved = !isNew && !dirty;
  const [pending, setPending] = useState(false);
  const activeSaving = saving || pending;

  async function handleSave() {
    setPending(true);
    try {
      await onSave();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`mt-5 gap-2 border-t border-slate-200 pt-4 ${mobileWide ? "flex flex-col sm:flex-row sm:justify-end" : "flex justify-end"}`}>
      <button
        type="button"
        disabled={activeSaving || saved}
        onClick={handleSave}
        className={`flex items-center gap-2 rounded-lg text-sm font-semibold transition disabled:cursor-default ${mobileWide ? "min-h-11 w-full justify-center px-4 py-2 sm:w-auto" : "px-3 py-2"} ${
          saved
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "cursor-pointer bg-cyan-400 text-[#020817] hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
        }`}
      >
        {activeSaving ? <Plus className="h-4 w-4" /> : saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {activeSaving ? "Saving..." : isNew ? addLabel : saved ? "Saved" : "Save"}
      </button>
      {!isNew && <button type="button" disabled={activeSaving} onClick={onDelete} className={`cursor-pointer rounded-lg border border-rose-200 bg-white py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 ${mobileWide ? "min-h-11 w-full px-4 sm:w-auto" : "px-3"}`}>Delete</button>}
    </div>
  );
}

function normalizeThreeDigitNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  listId,
  placeholder,
  inputMode,
  pattern,
  maxLength,
  normalizeValue,
  mobileFriendly = false,
  profileField = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  listId?: string;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  maxLength?: number;
  normalizeValue?: (value: string) => string;
  mobileFriendly?: boolean;
  profileField?: boolean;
}) {
  return (
    <div className="block">
      <p className={profileField ? profileFieldLabelClassName : mobileFriendly ? "mb-1.5 block select-text text-xs font-semibold text-slate-700" : "mb-2 block select-text text-sm font-medium text-slate-600"}>{label}</p>
      <input
        aria-label={label}
        type={type}
        value={value || ""}
        list={listId}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        onChange={(event) => onChange(normalizeValue ? normalizeValue(event.target.value) : event.target.value)}
        onPaste={
          normalizeValue
            ? (event) => {
                event.preventDefault();
                const input = event.currentTarget;
                const selectionStart = input.selectionStart ?? input.value.length;
                const selectionEnd = input.selectionEnd ?? selectionStart;
                const pastedValue = event.clipboardData.getData("text");
                onChange(normalizeValue(`${input.value.slice(0, selectionStart)}${pastedValue}${input.value.slice(selectionEnd)}`));
              }
            : undefined
        }
        className={profileField
          ? `${profileFieldControlClassName} py-0 placeholder:text-slate-400 disabled:opacity-40`
          : mobileFriendly
            ? "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:opacity-40 sm:text-sm"
            : "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 disabled:opacity-40"}
      />
    </div>
  );
}

function DateField({ label, value, onChange, disabled = false, mobileFriendly = false, profileField = false }: { label: string; value?: string; onChange: (value: string) => void; disabled?: boolean; mobileFriendly?: boolean; profileField?: boolean }) {
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
    <div className="block">
      <p className={profileField ? profileFieldLabelClassName : mobileFriendly ? "mb-1.5 block select-text text-xs font-semibold text-slate-700" : "mb-2 block select-text text-sm font-medium text-slate-600"}>{label}</p>
      <input
        aria-label={label}
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={display}
        disabled={disabled}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setDisplay(formatDateForDisplay(parseDisplayDate(display)))}
        className={profileField
          ? `${profileFieldControlClassName} py-0 placeholder:text-slate-400 disabled:opacity-40`
          : mobileFriendly
            ? "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:opacity-40 sm:text-sm"
            : "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 disabled:opacity-40"}
      />
    </div>
  );
}

function NationalitySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedCountry = nationalityOptions.find((country) => country.nationality === value);

  return (
    <div className="block">
      <p className={profileFieldLabelClassName}>Nationality</p>
      <CountrySearch
        selectedLabel={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.country} / ${selectedCountry.nationality}` : "Select nationality"}
        options={nationalityOptions}
        onSelect={(country) => onChange(country.nationality)}
        fullWidth
      />
    </div>
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
        className={fullWidth
          ? `${profileFieldControlClassName} flex items-center justify-between gap-2 py-0 text-left hover:text-cyan-800`
          : `flex min-h-11 w-full items-center justify-between gap-2 bg-white px-3 py-2.5 text-left text-base font-semibold text-slate-950 transition hover:text-cyan-800 sm:text-sm ${phoneMode ? "rounded-l-xl" : "rounded-xl border border-slate-200 shadow-sm"}`}
      >
        <span className="min-w-0 flex-1 truncate">{buttonLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden />
      </button>
      {open && (
        <div className="bd-auth-popover absolute left-0 top-[calc(100%+8px)] z-40 w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search country..."
            className="h-12 w-full border-b border-slate-200 px-4 py-0 text-base font-medium text-slate-950 outline-none sm:text-sm"
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
                <span className="min-w-0 flex-1 truncate">
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Array<{ label: string; detail: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 3) return;

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
  }, [query, open]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className="block">
      <p className={profileFieldLabelClassName}>Location</p>
      <div className="flex h-12 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/15">
        <span className="flex items-center pl-3 text-cyan-700">
          <MapPin className="h-4 w-4" />
        </span>
        <input
          value={query}
          onFocus={() => {
            setOpen(true);
            if (query.trim().length < 3) {
              setSuggestions([]);
              setSearching(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            onChange(nextQuery);
            setOpen(true);
            if (nextQuery.trim().length < 3) {
              setSuggestions([]);
              setSearching(false);
            }
          }}
          placeholder="Search any city, marina or country"
          className="h-full min-w-0 flex-1 px-3 py-0 text-base font-medium text-slate-950 outline-none sm:text-sm"
        />
      </div>
      {open && (suggestions.length > 0 || searching) && (
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
                setOpen(false);
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
    <div className="block">
      <p className={profileFieldLabelClassName}>{label}</p>
      <div className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className={`${profileFieldControlClassName} cursor-pointer appearance-none py-0 pr-10`}>
          <option value="">Select</option>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className = "mt-4",
  textareaClassName = "",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  textareaClassName?: string;
  maxLength?: number;
}) {
  const displayValue = maxLength ? value.slice(0, maxLength) : value;
  const currentLength = maxLength ? Math.min(displayValue.length, maxLength) : displayValue.length;

  return (
    <div className={`${className} block`}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="block select-text text-xs font-semibold leading-4 text-slate-700">{label}</p>
        {maxLength && (
          <span className="rounded-full border border-cyan-100 bg-[#f8fdff] px-2.5 py-1 text-[10px] font-black tabular-nums tracking-[0.08em] text-cyan-800 shadow-sm shadow-cyan-950/5">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        value={displayValue}
        maxLength={maxLength}
        onChange={(event) => onChange(maxLength ? event.target.value.slice(0, maxLength) : event.target.value)}
        className={`min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 sm:text-sm ${textareaClassName}`}
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-slate-700 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
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

function CvCompletionRing({ percent }: { percent: number }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#8ed8e6]/35 bg-white/10 px-3 py-2 text-white shadow-lg shadow-black/10">
      <span
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#8ed8e6 ${safePercent * 3.6}deg, rgba(255,255,255,0.16) 0deg)`,
        }}
        aria-label={`CV completion ${safePercent}%`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0d3f4b] text-[11px] font-black tabular-nums text-white">
          {safePercent}%
        </span>
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#8ed8e6]">CV</span>
        <span className="block text-xs font-black uppercase tracking-[0.08em] text-white">Completion</span>
      </span>
    </div>
  );
}

function PillList({ items, light = false }: { items: string[]; light?: boolean }) {
  if (items.length === 0) return <p className={light ? "text-slate-500" : "text-slate-500"}>-</p>;
  return <div className="bd-cv-pill-list flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item}-${index}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${light ? "border border-slate-200 bg-white text-slate-700" : "bg-cyan-400/10 text-cyan-200"}`}>{item}</span>)}</div>;
}

function normalizeProfile(profile: CrewProfile) {
  const currentPosition = getProfileCurrentPosition(profile);

  return {
    ...profile,
    bio: cleanLimitedText(profile.bio, professionalSummaryMaxLength),
    gender: cleanSaveText(profile.gender),
    current_position: currentPosition,
    current_positions: currentPosition ? [currentPosition] : [],
    seeking_positions: cleanSaveList(profile.seeking_positions),
    work_preferences: cleanSaveList(profile.work_preferences),
    personal_skills: cleanSaveList(profile.personal_skills),
    personal_characteristics: cleanSaveList(profile.personal_characteristics),
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
  return [day, month, year].filter(Boolean).join("/");
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
  return `${day}/${month}/${year}`;
}
