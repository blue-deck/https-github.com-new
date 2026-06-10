"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  Check,
  Download,
  ExternalLink,
  IdCard,
  Languages,
  Mail,
  MapPin,
  Pencil,
  Phone,
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
type CvStudioTab = "personal" | "experience" | "skills" | "documents" | "portfolio" | "languages" | "preview";

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
  const [savedProfile, setSavedProfile] = useState<CrewProfile>({});
  const [referenceSaving, setReferenceSaving] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [activeStudioTab, setActiveStudioTab] = useState<CvStudioTab>("personal");
  const [photoGallerySaving, setPhotoGallerySaving] = useState(false);
  const [photoGalleryEditing, setPhotoGalleryEditing] = useState(false);
  const [photoGalleryPreview, setPhotoGalleryPreview] = useState<PortfolioPhoto | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const uploadRunRef = useRef(0);

  const cvDocuments = documents.filter((item) => item.show_on_cv);
  const cvReferences = references.filter((item) => item.show_on_cv);
  const expiryAlerts = documents.filter((item) => !item.no_expiry && isWithin90Days(item.expiry_date));
  const profileDirty = !saveStateEquals(profileSaveState(profile), profileSaveState(savedProfile));
  const currentPositionValue = getProfileCurrentPosition(profile);
  const portfolioPhotoCount = portfolio.filter((item) => item.image_url).length;
  const skillsCount = (profile.personal_skills?.length || 0) + (profile.personal_characteristics?.length || 0) + (profile.work_preferences?.length || 0);
  const editableExperiences = useMemo(
    () =>
      [...experiences].sort((first, second) => {
        const firstCreatedAt = first.created_at ? Date.parse(first.created_at) : 0;
        const secondCreatedAt = second.created_at ? Date.parse(second.created_at) : 0;
        return secondCreatedAt - firstCreatedAt;
      }),
    [experiences],
  );
  const editablePortfolio = useMemo(
    () =>
      sortPortfolioPhotos(portfolio.filter((photo) => photo.image_url)),
    [portfolio],
  );

  const totalExperienceYears = useMemo(() => {
    const firstYear = experiences
      .map((item) => Number((item.start_date || "").slice(0, 4)))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    return firstYear ? `${Math.max(new Date().getFullYear() - firstYear, 1)}+` : "0";
  }, [experiences]);
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
      status: `${experiences.length} saved`,
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
      id: "portfolio",
      label: "Photo Gallery",
      description: "Yacht and work photos.",
      status: `${portfolioPhotoCount} photos`,
      icon: <Camera className="h-4 w-4" />,
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

    setDocuments(result.documents || []);
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
        email: normalizedForSave.email || user.email,
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
    const hasDocumentDetail = [
      nextDraft.document_type,
      nextDraft.category,
      nextDraft.issuer,
      nextDraft.issue_date,
      nextDraft.expiry_date,
      nextDraft.file_url,
      nextDraft.notes,
    ].some((value) => typeof value === "string" && value.trim().length > 0);

    if (!profile.id || !hasDocumentDetail) {
      alert("Add a document type, issuer, expiry date or file before saving.");
      return;
    }

    const documentType = cleanSaveText(nextDraft.document_type) || "Document";
    const category = cleanSaveText(nextDraft.category) || "General";
    const response = await saveRelatedRecord("document", {
      ...nextDraft,
      document_type: documentType,
      category,
      expiry_date: nextDraft.no_expiry ? null : nextDraft.expiry_date || null,
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
    if (!profile.id) return false;
    const response = await saveRelatedRecord(
      "portfolio",
      { ...item, title: "", location: encodeGalleryLocation(item.location, item.gallery_order) },
      item.id,
    );
    if (!response.ok) {
      alert(response.error);
      return false;
    }
    await loadRelated(profile.id);
    return true;
  }

  async function savePhotoGalleryPhoto(imageUrl: string) {
    if (!imageUrl) return false;
    setPhotoGallerySaving(true);
    const saved = await savePortfolioPhoto({
      ...emptyPhoto,
      image_url: imageUrl,
      location: "",
      gallery_order: nextPortfolioOrder(editablePortfolio),
    });
    setPhotoGallerySaving(false);

    return saved;
  }

  async function reorderPortfolioPhoto(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= editablePortfolio.length || photoGallerySaving) return;

    const nextOrder = [...editablePortfolio];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    const orderedPortfolio = nextOrder.map((photo, order) => ({ ...photo, gallery_order: order }));
    setPortfolio((current) => {
      const orderedIds = new Set(orderedPortfolio.map((photo) => photo.id || photo.image_url));
      const untouched = current.filter((photo) => !orderedIds.has(photo.id || photo.image_url));
      return [...orderedPortfolio, ...untouched];
    });

    if (!profile.id) return;
    setPhotoGallerySaving(true);
    const results = await Promise.all(
      orderedPortfolio.map((photo) =>
        saveRelatedRecord(
          "portfolio",
          { ...photo, title: "", location: encodeGalleryLocation(photo.location, photo.gallery_order) },
          photo.id,
        ),
      ),
    );
    setPhotoGallerySaving(false);

    const failed = results.find((result) => !result.ok);
    if (failed) {
      alert(failed.error);
    }
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
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">BlueDeck Profile</p>
            <h1 className="bd-serif mt-3 text-4xl font-normal text-[#071f3c] sm:text-5xl">
              {profile.full_name || "Professional Crew Profile"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Build a clean yachting CV from verified profile data, documents,
              work preferences, skills, references and photo gallery.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
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

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#2fb6c7]/25 bg-white shadow-2xl shadow-slate-950/14">
          <div className="h-1 bg-[linear-gradient(90deg,#07313b_0%,#8ed8e6_36%,#21aebf_72%,#0a4452_100%)]" />
          <div className="border-b border-white/12 bg-[linear-gradient(135deg,#08242e_0%,#0e4f5d_54%,#106f7f_100%)] px-4 py-5 text-white sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#8ed8e6]">BlueDeck CV Studio</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{activeStudioTabInfo.label}</h2>
                <p className="mt-1 text-sm font-semibold text-white/70">{activeStudioTabInfo.description}</p>
              </div>
              <span className="rounded-full border border-[#8ed8e6]/35 bg-white/10 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-black/10">
                {activeStudioTabInfo.status}
              </span>
            </div>
          </div>

          <div className="border-b border-[#2fb6c7]/25 bg-[linear-gradient(135deg,#0b5160_0%,#108094_52%,#0a4a58_100%)] px-3 pb-3 sm:px-5">
            <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-white/18 bg-white/[0.10] p-2 shadow-inner shadow-black/10">
              {studioTabs.map((tab) => {
                const active = activeStudioTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveStudioTab(tab.id)}
                    className={`group flex min-w-[188px] items-center gap-3 rounded-[18px] border px-3.5 py-3.5 text-left transition ${
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
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${active ? "bg-[#e6f8fb] text-[#2d7482]" : "bg-white/12 text-white/72"}`}>{tab.status}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#f6f9fa] p-4 sm:p-5">
            <div className="contents">
            <Panel
              active={activeStudioTab === "personal"}
              title="Personal details"
              icon={<UserRound className="h-5 w-5" />}
              action={
                <button
                  type="button"
                  onClick={() => saveProfile()}
                  disabled={saving || !profileDirty}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-[0.08em] shadow-sm transition disabled:cursor-default ${
                    profileDirty
                      ? "bg-[#5fd3e5] text-[#031923] hover:bg-[#84e6f3] disabled:opacity-70"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {saving ? <Plus className="h-4 w-4" /> : profileDirty ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  {saving ? "Saving..." : profileDirty ? "Save" : "Saved"}
                </button>
              }
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(320px,440px)_1fr]">
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
                  className="min-h-full"
                  textareaClassName="h-[calc(100%-30px)] min-h-40"
                  maxLength={professionalSummaryMaxLength}
                />
              </div>
              <Field label="Name and surname" value={profile.full_name} onChange={(value) => setProfile({ ...profile, full_name: value })} />
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
              />
              <DateField label="Date of birth" value={profile.date_of_birth} onChange={(value) => setProfile({ ...profile, date_of_birth: value })} />
              <NationalitySelect value={profile.nationality || ""} onChange={(value) => setProfile({ ...profile, nationality: value })} />
              <SelectField label="Gender" value={profile.gender || ""} options={["Female", "Male"]} onChange={(value) => setProfile({ ...profile, gender: value })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height cm" type="number" value={String(profile.height_cm || "")} onChange={(value) => setProfile({ ...profile, height_cm: Number(value) || undefined })} />
                <Field label="Weight kg" type="number" value={String(profile.weight_kg || "")} onChange={(value) => setProfile({ ...profile, weight_kg: Number(value) || undefined })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Smoker" value={profile.smoker || ""} options={["No", "Yes"]} onChange={(value) => setProfile({ ...profile, smoker: value })} />
                <SelectField label="Visible tattoos" value={profile.visible_tattoos || ""} options={["No", "Yes"]} onChange={(value) => setProfile({ ...profile, visible_tattoos: value })} />
              </div>
              <PhoneInput label="Mobile number" value={profile.phone || ""} onChange={(value) => setProfile({ ...profile, phone: value })} />
              <Field label="Email" value={profile.email} onChange={(value) => setProfile({ ...profile, email: value })} />
              <LocationSelect value={profile.location || ""} onChange={(value) => setProfile({ ...profile, location: value })} />
            </Panel>

          </div>

          <div className="contents">
            <Panel active={activeStudioTab === "experience"} title="Yacht experience" icon={<BriefcaseBusiness className="h-5 w-5" />}>
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

            <Panel active={activeStudioTab === "documents"} title="Documents & Certificates" icon={<IdCard className="h-5 w-5" />}>
              <DocumentCreator
                draft={documentDraft}
                setDraft={setDocumentDraft}
                onSave={saveDocument}
                onUpload={async (file, uploadedDraft) => {
                  const url = await uploadFile(file, "crew-documents", "document-file");
                  if (!url) return;

                  const nextDraft = { ...uploadedDraft, file_url: url };
                  setDocumentDraft(nextDraft);
                  await saveDocument(nextDraft);
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

            <Panel active={activeStudioTab === "portfolio"} title="Photo Gallery" icon={<Camera className="h-5 w-5" />}>
              <div className="mb-5 rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,#f7fdff_0%,#eef9fb_100%)] p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173f4a] text-white shadow-sm">
                      <Camera className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#06111f]">Professional photo gallery</p>
                      <p className="mt-1 max-w-4xl text-sm leading-6 text-[#5a6870]">
                        Add professional photos from your yacht work, service moments, onboard projects or maritime experience. They will appear in your public BlueDeck photo gallery.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoGalleryEditing((current) => !current)}
                    disabled={editablePortfolio.length < 2 || photoGallerySaving}
                    className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      photoGalleryEditing
                        ? "bg-[#173f4a] text-white"
                        : "border border-slate-200 bg-white text-[#173f4a] hover:border-cyan-300"
                    }`}
                  >
                    <Pencil className="h-4 w-4" />
                    {photoGalleryEditing ? "Done" : "Edit order"}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#173f4a] shadow-sm transition ${uploading === "photo-gallery-new" || photoGallerySaving ? "cursor-progress opacity-70" : "cursor-pointer hover:border-cyan-300 hover:text-cyan-800"}`}>
                    <Upload className="h-4 w-4 text-cyan-700" />
                    {uploading === "photo-gallery-new" ? "Uploading..." : photoGallerySaving ? "Saving..." : "Add photo"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading === "photo-gallery-new" || photoGallerySaving}
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (!file) return;
                        const url = await uploadFile(file, "crew-portfolio", "photo-gallery-new");
                        if (url) await savePhotoGalleryPhoto(url);
                      }}
                    />
                  </label>
                  {uploading === "photo-gallery-new" && (
                    <button type="button" onClick={cancelUpload} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
                      Cancel upload
                    </button>
                  )}
                  {photoGallerySaving && <span className="text-xs font-black uppercase tracking-[0.12em] text-[#2d7482]">Saving order...</span>}
                </div>
                <p className="mt-2 text-xs font-semibold text-[#6b7a82]">Photos are saved automatically after upload. Use edit order to arrange the public gallery.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {editablePortfolio.map((item, index) => (
                  <PortfolioEditor
                    key={item.id || item.image_url}
                    item={item}
                    editing={photoGalleryEditing}
                    canMoveLeft={index > 0}
                    canMoveRight={index < editablePortfolio.length - 1}
                    onMoveLeft={() => reorderPortfolioPhoto(index, -1)}
                    onMoveRight={() => reorderPortfolioPhoto(index, 1)}
                    onDelete={deletePortfolioPhoto}
                    onPreview={setPhotoGalleryPreview}
                  />
                ))}
                {editablePortfolio.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-cyan-200 bg-white/70 p-5 text-sm font-semibold text-slate-500">
                    No gallery photos yet. Add another photo whenever you are ready.
                  </div>
                )}
              </div>
            </Panel>

            {photoGalleryPreview && (
              <div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-[#06111f]/55 p-4 backdrop-blur-sm"
                onMouseDown={() => setPhotoGalleryPreview(null)}
              >
                <div
                  className="relative w-[min(760px,86vw)] rounded-3xl bg-white p-3 shadow-2xl shadow-slate-950/30"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setPhotoGalleryPreview(null)}
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-xl font-semibold text-[#06111f] shadow-lg shadow-slate-950/15 transition hover:bg-cyan-50"
                    aria-label="Close photo preview"
                  >
                    ×
                  </button>
                  <img
                    src={photoGalleryPreview.image_url}
                    alt="Photo gallery preview"
                    className="max-h-[70vh] w-full rounded-2xl object-contain"
                  />
                </div>
              </div>
            )}

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

            <Panel active={activeStudioTab === "skills"} title="Work preferences" icon={<Star className="h-5 w-5" />}>
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
              />
            </Panel>

            <Panel active={activeStudioTab === "skills"} title="Skills & characteristics" icon={<Check className="h-5 w-5" />}>
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
              />
            </Panel>

            {activeStudioTab === "preview" && (
              <div className="space-y-5">
                <Panel title="Preview / Download" icon={<Download className="h-5 w-5" />}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8e2e6] bg-[#f8fbfc] p-4">
                    <div>
                      <p className="text-sm font-black text-[#06111f]">Final BlueDeck CV</p>
                      <p className="mt-1 text-sm leading-6 text-[#5a6870]">
                        Review the generated CV below. Use the Download button inside the preview to save the exact CV layout.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#173f4a] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white">
                      {cvDocuments.length} CV docs
                    </span>
                  </div>
                </Panel>
                  <SeazoneStyleCvPreview
                    profile={profile}
                    documents={cvDocuments}
                    experiences={experiences}
                    references={cvReferences}
                    totalExperienceYears={totalExperienceYears}
                    downloading={pdfDownloading}
                    onDownload={async () => {
                      setPdfDownloading(true);
                      try {
                        await downloadCvPdf(profile);
                      } catch (error) {
                        alert(error instanceof Error ? error.message : "CV PDF could not be downloaded.");
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
  onUpload,
  onCancelUpload,
  uploading,
}: {
  draft: CrewDocument;
  setDraft: (draft: CrewDocument) => void;
  onSave: (draft?: CrewDocument) => void;
  onUpload: (file: File, draft: CrewDocument) => void | Promise<void>;
  onCancelUpload: () => void;
  uploading: boolean;
}) {
  const selectedCategory = documentCatalog.find((group) => group.items.includes(draft.document_type))?.category || "";

  return (
    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-2 block select-text text-sm font-medium text-slate-600">Document type</p>
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
        </div>
        <Field label="Issuer / authority" value={draft.issuer} onChange={(value) => setDraft({ ...draft, issuer: capitalizeFirstCharacter(value) })} />
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
              if (file) onUpload(file, draft);
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
        <button type="button" onClick={() => onSave()} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#020817]">
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

function encodeGalleryLocation(location?: string | null, order?: number) {
  const cleanLocation = cleanSaveText(location);
  if (typeof order !== "number" || !Number.isFinite(order)) return cleanLocation;
  return `${galleryOrderPrefix}${order}\n${cleanLocation}`;
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

function nextPortfolioOrder(photos: PortfolioPhoto[]) {
  if (photos.length === 0) return 0;
  return Math.min(...photos.map((photo, index) => portfolioSortValue(photo, index))) - 1;
}

function cvPdfFileName(profile: CrewProfile) {
  const name = cleanSaveText(profile.full_name)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
  return `${name || "BLUEDECK CREW"} - CV BlueDeck Yacht Management Platform.pdf`;
}

async function downloadCvPdf(profile: CrewProfile) {
  const sheet = document.querySelector<HTMLElement>("#bluedeck-cv .bd-cv-sheet");
  if (!sheet) {
    alert("CV preview is not ready yet.");
    return;
  }

  const { default: html2pdf } = await import("html2pdf.js");
  const filename = cvPdfFileName(profile);
  const pdfOptions = {
    margin: 0,
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: 980,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    pagebreak: {
      mode: ["css", "legacy"],
      before: [".bd-cv-experience-break-before", ".bd-cv-documents-section"],
    },
  };
  document.body.classList.add("bd-pdf-exporting");

  try {
    await html2pdf()
      .set(pdfOptions)
      .from(sheet)
      .save(filename);
  } finally {
    document.body.classList.remove("bd-pdf-exporting");
  }
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
  onDownload: () => void | Promise<void>;
}) {
  const primaryPosition = profile.current_positions?.[0] || profile.current_position || "Yacht Crew";
  const cleanExperiences = experiences.filter((item) => item.yacht_name || item.position || item.description);
  const cleanReferences = cleanReferenceEntries(references);
  const standaloneReferences = unmatchedExperienceReferences(cleanExperiences, cleanReferences);
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
      <div className="flex items-center justify-between gap-4 border-b border-[#b9c8cd] bg-white px-5 py-4 print:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#228fc4]">BlueDeck crew CV</p>
          <p className="mt-1 text-sm text-slate-500">Minimal maritime CV generated from your saved profile.</p>
        </div>
        <button
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#5fd3e5] px-4 py-3 text-sm font-black text-[#031923] shadow-lg shadow-cyan-950/15 transition hover:bg-[#86e7f3] disabled:cursor-progress disabled:opacity-70"
        >
          {downloading ? <Plus className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {downloading ? "Preparing..." : "Download"}
        </button>
      </div>

      <div className="overflow-x-auto bg-[#f3f7f8] p-3 sm:p-5 print:overflow-visible print:p-0">
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
                    {documents.slice(0, 8).map((doc) => (
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
                  <p className="rounded-2xl border border-[#d8e2e6] bg-[#f6f8f8] p-4 text-[14px] leading-7 text-[#3d454c]">
                    {professionalSummary}
                  </p>
                </SeazoneSection>

                <SeazoneSection title="Yacht Experience" badge={`${totalExperienceYears} years`}>
                <div className="bd-cv-experience-list space-y-4">
                  {cleanExperiences.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#c7d2d6] bg-[#f6f8f8] p-5 text-sm text-[#5a6870]">
                      No yacht experience added yet.
                    </p>
                  )}
                  {cleanExperiences.map((item, index) => (
                    <SeazoneExperienceCard
                      key={item.id || `${item.yacht_name}-${item.start_date}`}
                      experience={item}
                      references={referencesForExperience(item, cleanReferences)}
                      breakBefore={shouldBreakBeforeExperience(index)}
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
        <p className="mt-0.5 text-[10px] font-bold uppercase leading-3 tracking-[0.16em] text-[#59666d]">Yachtos</p>
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
  const yachtName = experience.yacht_name || "Yacht";

  return (
    <article className={`bd-cv-experience rounded-2xl border border-[#d8e2e6] bg-white p-3 shadow-sm shadow-slate-950/5 ${breakBefore ? "bd-cv-experience-break-before" : ""}`}>
      <div className="bd-cv-experience-grid grid items-stretch gap-3 sm:grid-cols-[136px_1fr]">
        <div className="bd-cv-experience-meta h-full rounded-xl border border-[#d8e2e6] bg-[#f6f8f8] p-2">
          {experience.photo_url ? (
            <img src={experience.photo_url} alt={yachtName} className="h-24 w-full rounded-lg object-cover" />
          ) : (
            <div className="h-24 rounded-lg bg-[linear-gradient(135deg,#f5f8f9,#e8f0f2)]" />
          )}
          <div className="mt-3">
            <h4 className="font-black uppercase leading-[1.05] text-[#06111f]" style={{ fontSize: yachtNameFontSize(yachtName) }}>{yachtName}</h4>
            {[experience.yacht_type, experience.yacht_program, experience.yacht_size].filter(Boolean).length > 0 && (
              <p className="mt-1 text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-[#6b747a]">
                {[experience.yacht_type, experience.yacht_program, experience.yacht_size].filter(Boolean).join(" / ")}
              </p>
            )}
            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#2d7482]">{formatDateRange(experience.start_date, experience.end_date)}</p>
            {experience.location && (
              <p className="mt-1 flex items-start gap-1.5 text-[10px] font-black uppercase leading-4 tracking-[0.06em] text-[#2d7482]">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{experience.location}</span>
              </p>
            )}
            <span className="mt-2 inline-flex rounded-md bg-[#173f4a] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
              {experience.position || "Position"}
            </span>
          </div>
        </div>

        <div className="bd-cv-experience-body h-full rounded-xl border border-[#dbe4e7] bg-[#f6f8f8] p-3">
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
    <div className="bd-cv-reference-list mt-3 border-t border-[#c7d2d6] pt-3">
      <div className="grid gap-2">
        {references.slice(0, 2).map((reference) => (
          <div key={reference.id || reference.email || reference.phone || reference.name} className="bd-cv-reference-card rounded-lg border border-[#d8e2e6] bg-white px-3 py-2">
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
    <div className={`bd-cv-document-row rounded-lg border px-3 py-2 ${expiring ? "border-[#d8b4a0] bg-[#fff7f3]" : "border-[#c7d2d6] bg-[#f6f8f8]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black leading-4 text-[#06111f]">{document.document_type || "Document"}</p>
          <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#7a858b]">{document.category || "Certificate"}</p>
          {document.issuer && <p className="mt-1 truncate text-[10px] font-semibold text-[#5a6870]">{document.issuer}</p>}
        </div>
        <p className={`shrink-0 text-right text-[10px] font-black ${expiring ? "text-[#9a4b2e]" : "text-[#2d7482]"}`}>
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
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="h-1 bg-[linear-gradient(90deg,#07111f,#0891b2,#2d7482)]" />
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0e7490,#67e8f9)] text-white shadow-lg shadow-cyan-900/15">{icon}</div>
            <h2 className="truncate text-base font-semibold text-slate-950">{title}</h2>
          </div>
          {action && <div className="shrink-0">{action}</div>}
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
}) {
  const [open, setOpen] = useState(false);
  const displayValue = singleSelect ? value.slice(0, 1) : value;
  const [draft, setDraft] = useState(displayValue);
  const hasSelection = displayValue.length > 0;
  const selectedText = hasSelection ? displayValue.join(", ") : "Select";
  const triggerTitle = selectedAsTitle && hasSelection ? selectedText : title;
  const triggerMeta = selectedAsTitle && hasSelection ? "Change" : selectedPanel || inlineSelected ? `${displayValue.length}${maxSelected ? `/${maxSelected}` : ""} selected` : selectedText;

  useEffect(() => {
    setDraft(displayValue);
  }, [value]);

  function updateSelection(option: string) {
    const selected = draft.includes(option);

    if (singleSelect) {
      onChange([option]);
      setDraft([option]);
      setOpen(false);
      return;
    }

    if (!selected && maxSelected && draft.length >= maxSelected) return;

    const nextDraft = selected ? draft.filter((item) => item !== option) : [...draft, option];
    setDraft(nextDraft);
    if (commitOnSelect) onChange(nextDraft);
    if (!selected && maxSelected && nextDraft.length >= maxSelected) setOpen(false);
  }

  function removeSelection(item: string) {
    const nextValue = displayValue.filter((selected) => selected !== item);
    setDraft(nextValue);
    onChange(nextValue);
  }

  return (
    <div>
      <div className={selectedPanel ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]" : ""}>
        <button
          type="button"
          onClick={() => {
            setDraft(displayValue);
            setOpen(!open);
          }}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm"
        >
          <span className="min-w-0 truncate">{triggerTitle}</span>
          <span className="ml-3 shrink-0 text-right text-xs text-cyan-700">{triggerMeta}</span>
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
      )}
      {displayValue.length > 0 && !selectedAsTitle && !selectedPanel && !inlineSelected && <PillList items={displayValue} light />}
      {open && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-[#fbfaf7] p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((option) => {
              const selected = draft.includes(option);
              const locked = !selected && Boolean(maxSelected && draft.length >= maxSelected);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={locked}
                  onClick={() => updateSelection(option)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
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
          {maxSelected && <p className="mt-3 text-xs font-semibold text-slate-500">Maximum {maxSelected} selections.</p>}
          {!singleSelect && !commitOnSelect && <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft(displayValue);
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

function DocumentCard({ document, onChange, onDelete }: { document: CrewDocument; onChange: (document: CrewDocument) => void; onDelete: (id?: string) => void }) {
  const alert = !document.no_expiry && isWithin90Days(document.expiry_date);
  return (
    <article className={`rounded-2xl border p-4 ${alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950">{document.document_type || "Document"}</p>
          <p className="mt-1 text-xs text-slate-500">{document.category || "General"}</p>
          {document.issuer && <p className="mt-1 truncate text-xs font-semibold text-cyan-800">{document.issuer}</p>}
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
  onSave: (item: Experience) => Promise<boolean>;
  onDelete: (id?: string) => void;
  onSaveReference: (item: ReferenceEntry) => Promise<boolean>;
  onDeleteReference: (id?: string) => void;
  onUpload: (file: File) => Promise<string>;
  onCancelUpload: () => void;
  uploading: boolean;
}) {
  const [draft, setDraft] = useState(item);
  const dirty = !saveStateEquals(experienceSaveState(draft), experienceSaveState(item));
  const dutiesValue = (draft.description || "").slice(0, yachtDutiesMaxLength);
  const dutiesLength = dutiesValue.length;

  function removePhoto() {
    setDraft({ ...draft, photo_url: "" });
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
      <div className="grid items-stretch gap-3 sm:grid-cols-[156px_1fr]">
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
            <ExperienceCardSelect
              label="Yacht type"
              value={draft.yacht_type || ""}
              options={yachtTypeOptions}
              onChange={(value) => setDraft({ ...draft, yacht_type: value })}
            />
            <ExperienceCardSelect
              label="Yacht program"
              value={draft.yacht_program || ""}
              options={yachtProgramOptions}
              onChange={(value) => setDraft({ ...draft, yacht_program: value })}
            />
            <ExperienceSizeField
              value={draft.yacht_size || ""}
              onChange={(value) => setDraft({ ...draft, yacht_size: value })}
            />
            <div className="grid gap-1.5">
              <ExperienceCardDateField label="Start date" value={draft.start_date} onChange={(value) => setDraft({ ...draft, start_date: value })} />
              <ExperienceCardDateField label="End date" value={draft.end_date} onChange={(value) => setDraft({ ...draft, end_date: value })} />
            </div>
            <div className="grid grid-cols-[22px_1fr] items-center overflow-hidden rounded-lg border border-[#d8e2e6] bg-white transition focus-within:border-[#2d7482] focus-within:ring-2 focus-within:ring-[#2d7482]/15">
              <span className="flex h-full items-center justify-center text-[#2d7482]">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <input
                aria-label="Location"
                value={draft.location || ""}
                onChange={(event) => setDraft({ ...draft, location: capitalizeFirstCharacter(event.target.value) })}
                placeholder="Location"
                className="min-w-0 border-0 bg-white px-1.5 py-2 text-[12px] font-semibold text-[#2d7482] outline-none placeholder:text-[#9aa8ae]"
              />
            </div>
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
          <div className="mb-3 rounded-xl border border-[#d8e2e6] bg-white p-2.5 shadow-sm shadow-slate-950/5">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
              <ExperienceCardInput
                label="Yacht name"
                value={draft.yacht_name}
                placeholder="Yacht name"
                strong
                onChange={(value) => setDraft({ ...draft, yacht_name: value })}
              />
              <select
                aria-label="Position"
                value={draft.position || ""}
                onChange={(event) => setDraft({ ...draft, position: event.target.value })}
                className="w-full cursor-pointer rounded-lg border border-[#173f4a] bg-[#173f4a] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white outline-none transition focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/20"
              >
                <option value="">Position</option>
                {yachtPositionTitles.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between gap-3">
              <p className="select-text text-[10px] font-black uppercase tracking-[0.18em] text-[#6b7b84]">Duties</p>
              <span className="rounded-full border border-[#c7d2d6] bg-white px-2.5 py-1 text-[10px] font-black tabular-nums tracking-[0.08em] text-[#2d7482]">
                {dutiesLength}/{yachtDutiesMaxLength}
              </span>
            </div>
            <textarea
              value={dutiesValue}
              maxLength={yachtDutiesMaxLength}
              onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, yachtDutiesMaxLength) })}
              placeholder="Responsibilities and onboard duties"
              className="mt-2 min-h-24 flex-1 resize-y rounded-lg border border-[#d8e2e6] bg-white px-3 py-2.5 text-[13px] leading-5 text-[#364650] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15"
            />
          </div>
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
          <EditorButtons isNew={isNew} dirty={dirty} onSave={() => onSave(draft)} onDelete={() => onDelete(draft.id)} addLabel="Add experience" />
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
    <div className="block">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-[#d8e2e6] bg-white px-2.5 py-2 outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15 ${strong ? "text-[15px] font-black leading-tight text-[#06111f]" : "text-[12px] font-semibold text-[#2d7482]"}`}
      />
    </div>
  );
}

function ExperienceCardSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="block">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full cursor-pointer rounded-lg border border-[#d8e2e6] bg-white px-2.5 py-2 text-[12px] font-semibold text-[#2d7482] outline-none transition focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExperienceSizeField({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
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
      <span className="sr-only">Yacht size</span>
      <div className="grid grid-cols-[1fr_58px] overflow-hidden rounded-lg border border-[#d8e2e6] bg-white transition focus-within:border-[#2d7482] focus-within:ring-2 focus-within:ring-[#2d7482]/15">
        <input
          aria-label="Yacht size"
          inputMode="numeric"
          pattern="[0-9]*"
          value={parsed.amount}
          onChange={(event) => updateAmount(event.target.value.replace(/[^\d]/g, ""))}
          placeholder="Size"
          className="min-w-0 border-0 bg-white px-2.5 py-2 text-[12px] font-semibold text-[#2d7482] outline-none placeholder:text-[#9aa8ae]"
        />
        <select
          aria-label="Yacht size unit"
          value={selectedUnit}
          onChange={(event) => updateUnit(event.target.value as YachtSizeUnit)}
          className="cursor-pointer border-0 border-l border-[#d8e2e6] bg-[#f6f8f8] px-1.5 py-2 text-[11px] font-black uppercase tracking-[0.06em] text-[#173f4a] outline-none"
        >
          <option value="ft">ft</option>
          <option value="m">m</option>
        </select>
      </div>
    </div>
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
    <div className="block">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        inputMode="numeric"
        value={display}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setDisplay(formatDateForDisplay(parseDisplayDate(display)))}
        placeholder={label}
        className="w-full rounded-lg border border-[#d8e2e6] bg-white px-2.5 py-1.5 text-[12px] font-semibold leading-5 text-[#2d7482] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:ring-2 focus:ring-[#2d7482]/15"
      />
    </div>
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
  const dirty = !saveStateEquals(referenceSaveState({ ...draft, name: nameValue }), referenceSaveState(item));
  const saved = !isNew && !dirty;

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
            disabled={saving || saved}
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
    <div className="block">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-[#d8e2e6] bg-[#f6f8f8] px-2.5 text-[12px] font-semibold text-[#364650] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#2d7482] focus:bg-white focus:ring-2 focus:ring-[#2d7482]/15"
      />
    </div>
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
  editing,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onPreview,
}: {
  item: PortfolioPhoto;
  editing: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: (id?: string) => void;
  onPreview: (item: PortfolioPhoto) => void;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onPreview(item)}
        className="group block aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-[#eef6f8] shadow-sm shadow-slate-950/8 transition hover:shadow-lg hover:shadow-cyan-950/12"
      >
        <img src={item.image_url} alt="Photo gallery" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
      </button>
      <div className="mt-2 grid gap-1.5">
        {editing && (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onMoveLeft}
              disabled={!canMoveLeft}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-cyan-100 bg-white text-[#173f4a] transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Move photo left"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveRight}
              disabled={!canMoveRight}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-cyan-100 bg-white text-[#173f4a] transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Move photo right"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <button type="button" onClick={() => onDelete(item.id)} className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-rose-100 bg-white px-2 text-[10px] font-black uppercase tracking-[0.08em] text-rose-700 transition hover:bg-rose-50">
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
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
}: {
  isNew: boolean;
  dirty?: boolean;
  onSave: () => unknown | Promise<unknown>;
  onDelete: () => void;
  addLabel: string;
  saving?: boolean;
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
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={activeSaving || saved}
        onClick={handleSave}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-default ${
          saved
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "cursor-pointer bg-cyan-400 text-[#020817] hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
        }`}
      >
        {activeSaving ? <Plus className="h-4 w-4" /> : saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {activeSaving ? "Saving..." : isNew ? addLabel : saved ? "Saved" : "Save"}
      </button>
      {!isNew && <button type="button" disabled={activeSaving} onClick={onDelete} className="cursor-pointer rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">Delete</button>}
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
    <div className="block">
      <p className="mb-2 block select-text text-sm font-medium text-slate-600">{label}</p>
      <input type={type} value={value || ""} list={listId} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 disabled:opacity-40" />
    </div>
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
    <div className="block">
      <p className="mb-2 block select-text text-sm font-medium text-slate-600">{label}</p>
      <input
        inputMode="numeric"
        placeholder="DD.MM.YYYY"
        value={display}
        disabled={disabled}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setDisplay(formatDateForDisplay(parseDisplayDate(display)))}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 disabled:opacity-40"
      />
    </div>
  );
}

function NationalitySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedCountry = nationalityOptions.find((country) => country.nationality === value);

  return (
    <div className="block">
      <p className="mb-2 block select-text text-sm font-medium text-slate-600">Nationality</p>
      <div className="rounded-xl border border-slate-200 bg-white">
        <CountrySearch
          selectedLabel={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.country} / ${selectedCountry.nationality}` : "Select nationality"}
          options={nationalityOptions}
          onSelect={(country) => onChange(country.nationality)}
          fullWidth
        />
      </div>
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
      <p className="mb-2 block select-text text-sm font-medium text-slate-600">Location</p>
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-cyan-500">
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
          className="min-w-0 flex-1 px-3 py-3 text-sm text-slate-950 outline-none"
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
      <p className="mb-2 block select-text text-sm font-medium text-slate-600">{label}</p>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-cyan-500">
        <option value="">Select</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="block select-text text-sm font-medium text-slate-600">{label}</p>
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
        className={`h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-500 ${textareaClassName}`}
      />
    </div>
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
