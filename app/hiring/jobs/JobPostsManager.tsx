"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Eye,
  FilePenLine,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Ship,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { DateTextField } from "../../components/DateTextField";
import { CountryFlagField } from "../../components/CountryFlagField";
import { useLanguage } from "../../components/LanguageProvider";
import { LocationSearchField } from "../../components/LocationSearchField";
import { YachtSizeField } from "../../components/YachtSizeField";
import {
  formatJobMinimumYachtExperience,
  formatJobRequiredLanguage,
  formatJobSmokerPolicy,
  formatJobVisa,
  formatJobVisibleTattooPolicy,
  formatJobYachtType,
  formatJobListingNumber,
  isEmployerJobPostExpired,
  isJobSalaryCurrencyOption,
  jobCertificateOptions,
  jobCharacteristicOptions,
  jobEmploymentTypes,
  jobMinimumYachtExperiences,
  jobRequiredLanguages,
  jobSalaryCurrencyOptions,
  jobSalaryPeriods,
  jobSkillOptions,
  jobSmokerPolicies,
  jobVisibleTattooPolicies,
  jobVisaOptions,
  jobYachtTypes,
  maximumJobCertificateSelections,
  maximumJobCharacteristicSelections,
  maximumJobSkillSelections,
  maximumJobVisaSelections,
  type EmployerJobPost,
  type JobCandidateType,
  type JobCertificate,
  type JobCharacteristic,
  type JobMinimumYachtExperience,
  type JobRequiredLanguage,
  type JobSalaryCurrencyOption,
  type JobSkill,
  type JobSmokerPolicy,
  type JobVisibleTattooPolicy,
  type JobVisa,
  type JobPostStatus,
  type JobYachtLengthUnit,
  type JobYachtType,
  type VerifiedEmployerYacht,
} from "../../lib/jobPosts";
import { positionSelectGroups } from "../../lib/yachtOperations";
import { supabase } from "../../lib/supabase";

type WorkspaceResponse = {
  ok?: boolean;
  error?: string;
  yachts?: VerifiedEmployerYacht[];
  jobs?: EmployerJobPost[];
};

type MutationResponse = {
  ok?: boolean;
  error?: string;
  job?: EmployerJobPost;
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

type FormState = {
  yachtId: string;
  position: string;
  employmentType: (typeof jobEmploymentTypes)[number];
  candidateType: JobCandidateType;
  smokerPolicy: JobSmokerPolicy;
  visibleTattooPolicy: JobVisibleTattooPolicy;
  requiredLanguages: JobRequiredLanguage[];
  yachtBrand: string;
  yachtFlagCountryCode: string;
  yachtBuildYear: string;
  yachtType: JobYachtType | "";
  yachtLength: string;
  yachtLengthUnit: JobYachtLengthUnit;
  crewMemberCount: string;
  minimumYachtExperience: JobMinimumYachtExperience | "";
  location: string;
  startDate: string;
  description: string;
  requiredSkills: JobSkill[];
  requiredCharacteristics: JobCharacteristic[];
  requiredCertificates: JobCertificate[];
  requiredVisas: JobVisa[];
  benefits: string;
  salaryVisible: boolean;
  salaryAmount: string;
  salaryCurrency: JobSalaryCurrencyOption;
  salaryPeriod: (typeof jobSalaryPeriods)[number];
};

const copy = {
  en: {
    back: "Hiring workspace",
    publicBoard: "View public jobs",
    live: "Published",
    drafts: "Drafts",
    newPost: "New job post",
    loading: "Loading your job posting workspace…",
    loadError: "Your job posting workspace could not be loaded.",
    retry: "Try again",
    accessRequired: "Connect a yacht to publish roles",
    accessRequiredText:
      "Captain, Owner and Management accounts can publish for a yacht they own or actively manage. Add or connect your yacht first.",
    reviewAccess: "Open hiring workspace",
    createTitle: "Create a job post",
    editTitle: "Edit job post",
    listingNumber: "Listing no.",
    status: "Status",
    draft: "Draft",
    published: "Published",
    closedStatus: "Closed",
    expiredStatus: "Expired",
    cancelledStatus: "Cancelled",
    identity: "Job basics",
    publishingAccount: "Publishing account",
    publishingAccountHelp:
      "This private selector controls publishing authority. Public yacht identity follows the visibility setting below.",
    position: "Position",
    positionPlaceholder: "Select a position",
    employmentType: "Employment type",
    teamCouple: "Team / Couple",
    yes: "Yes",
    no: "No",
    candidatePreferences: "Candidate requirements",
    smoker: "Smoking",
    visibleTattoos: "Visible tattoos",
    requiredLanguages: "Required languages",
    languageHint: "Select all languages required for the role",
    minimumYachtExperience: "Minimum yacht experience",
    minimumYachtExperiencePlaceholder: "Select experience",
    permanent: "Permanent",
    temporary: "Temporary",
    seasonal: "Seasonal",
    rotation: "Rotation",
    daywork: "Daywork",
    yachtDetails: "Yacht details",
    yachtBrand: "Yacht brand",
    yachtBrandPlaceholder: "Optional",
    yachtFlag: "Yacht flag",
    yachtFlagPlaceholder: "Search country",
    yachtFlagClear: "Clear yacht flag",
    yachtFlagNoResults: "No matching country found",
    yachtBuildYear: "Yacht build year",
    yachtBuildYearPlaceholder: "e.g. 2024",
    yachtBuildYearError:
      "Yacht build year must be a four-digit year between 1800 and 2100.",
    yachtType: "Yacht type",
    yachtTypePlaceholder: "Select yacht type",
    yachtLength: "Yacht length",
    yachtLengthAmount: "Yacht length value",
    yachtLengthUnit: "Yacht length unit",
    yachtLengthPlaceholder: "e.g. 27",
    crewMemberCount: "Crew member count",
    crewMemberCountPlaceholder: "e.g. 12",
    crewMemberCountError:
      "Crew member count must be a whole number between 1 and 200.",
    yachtDetailsRequired:
      "Select a yacht type and enter a valid yacht length before publishing.",
    logistics: "Timing and location",
    location: "Location",
    locationPlaceholder: "Search city or port",
    locationSearching: "Searching locations…",
    locationNoResults: "No matching location found. You can keep your own text.",
    locationResults: "location options available.",
    startDate: "Job start date",
    datePlaceholder: "DD/MM/YYYY",
    invalidDate: "Enter a valid date in DD/MM/YYYY format.",
    narrative: "Description & salary",
    description: "Full description",
    descriptionPlaceholder:
      "Describe the yacht environment, role, schedule and what success looks like.",
    skillsCharacteristics: "Skills & characteristics",
    skills: "Skills",
    skillsHint: "Select up to 5 skills required for the role.",
    characteristics: "Characteristics",
    characteristicsHint: "Select up to 5 characteristics for the ideal candidate.",
    requirements: "Requirements",
    certificatesDocuments: "Certificates & documents",
    certificatesDocumentsHint:
      "Select the maritime and yachting documents required for the role.",
    visas: "Required visas",
    visasHint: "Select every visa candidates must already hold.",
    selected: "selected",
    maximumFive: "Maximum 5 selections.",
    selectAllApplicable: "Select all that apply.",
    benefits: "Benefits",
    listHint: "One item per line",
    benefitsPlaceholder: "Rotation schedule\nTravel covered",
    salary: "Salary",
    salaryVisible: "Show salary publicly",
    salaryVisibleHelp:
      "When disabled, amounts remain private in this employer workspace.",
    salaryAmount: "Salary",
    currency: "Currency",
    period: "Period",
    day: "Day",
    week: "Week",
    month: "Month",
    year: "Year",
    saveDraft: "Save draft",
    publish: "Publish role",
    saveLive: "Save live changes",
    cancelPost: "Cancel listing",
    cancelConfirm:
      "Cancel this listing? It will be removed from the public jobs board and will no longer accept applications. Application history will be preserved.",
    saving: "Saving…",
    viewLive: "View live post",
    applications: "Applications",
    savedDraft: "Draft saved.",
    savedPublished: "Job post published.",
    savedCancelled: "Job post cancelled.",
    saveError: "The job post could not be saved.",
    changedElsewhere:
      "This version may be out of date. Reload the workspace and try again.",
    terminalTitle: "This listing has ended",
    terminalExpired:
      "The one-month publishing period has ended. The listing is no longer public and cannot be reopened.",
    terminalCancelled:
      "This listing was cancelled and is no longer public. Its application history remains available.",
    terminalClosed:
      "This listing is closed and can no longer be edited or republished.",
    selectPost: "Select a post",
  },
  tr: {
    back: "İşe alım alanı",
    publicBoard: "Yayındaki ilanları gör",
    live: "Yayında",
    drafts: "Taslak",
    newPost: "Yeni iş ilanı",
    loading: "İş ilanı alanın yükleniyor…",
    loadError: "İş ilanı alanın yüklenemedi.",
    retry: "Tekrar dene",
    accessRequired: "İlan vermek için bir yat bağlayın",
    accessRequiredText:
      "Captain, Owner ve Management hesapları sahibi oldukları veya aktif olarak yönettikleri yat için ilan verebilir. Önce yatınızı ekleyin ya da hesabınıza bağlayın.",
    reviewAccess: "İşe alım alanını aç",
    createTitle: "İş ilanı oluştur",
    editTitle: "İş ilanını düzenle",
    listingNumber: "İlan no:",
    status: "Durum",
    draft: "Taslak",
    published: "Yayında",
    closedStatus: "Kapalı",
    expiredStatus: "Süresi doldu",
    cancelledStatus: "İptal edildi",
    identity: "Temel ilan bilgileri",
    publishingAccount: "Yayınlayan hesap",
    publishingAccountHelp:
      "Bu özel seçim ilan yayınlama yetkisini belirler. Yat kimliğinin görünürlüğünü aşağıdaki ayardan yönetebilirsiniz.",
    position: "Pozisyon",
    positionPlaceholder: "Pozisyon seç",
    employmentType: "Çalışma biçimi",
    teamCouple: "Team / Couple",
    yes: "Evet",
    no: "Hayır",
    candidatePreferences: "Aday gereksinimleri",
    smoker: "Sigara",
    visibleTattoos: "Görünür dövme",
    requiredLanguages: "Gerekli diller",
    languageHint: "Pozisyon için gerekli tüm dilleri seçin",
    minimumYachtExperience: "Minimum yat deneyimi",
    minimumYachtExperiencePlaceholder: "Deneyim seç",
    permanent: "Sürekli",
    temporary: "Geçici",
    seasonal: "Sezonluk",
    rotation: "Rotasyon",
    daywork: "Günlük iş",
    yachtDetails: "Yat bilgileri",
    yachtBrand: "Yat markası",
    yachtBrandPlaceholder: "Optional",
    yachtFlag: "Yat bayrağı",
    yachtFlagPlaceholder: "Ülke ara",
    yachtFlagClear: "Yat bayrağını temizle",
    yachtFlagNoResults: "Eşleşen ülke bulunamadı",
    yachtBuildYear: "Yat yapım yılı",
    yachtBuildYearPlaceholder: "Örn. 2024",
    yachtBuildYearError:
      "Yat yapım yılı 1800 ile 2100 arasında dört haneli bir yıl olmalıdır.",
    yachtType: "Yat türü",
    yachtTypePlaceholder: "Yat türünü seç",
    yachtLength: "Yat uzunluğu",
    yachtLengthAmount: "Yat uzunluğu değeri",
    yachtLengthUnit: "Yat uzunluğu birimi",
    yachtLengthPlaceholder: "Örn. 27",
    crewMemberCount: "Mürettebat sayısı",
    crewMemberCountPlaceholder: "Örn. 12",
    crewMemberCountError:
      "Mürettebat sayısı 1 ile 200 arasında tam sayı olmalıdır.",
    yachtDetailsRequired:
      "İlanı yayınlamadan önce yat türünü seçin ve geçerli bir yat uzunluğu girin.",
    logistics: "Tarih ve konum",
    location: "Konum",
    locationPlaceholder: "Şehir veya liman ara",
    locationSearching: "Konumlar aranıyor…",
    locationNoResults:
      "Eşleşen konum bulunamadı. Yazdığınız konumu kullanabilirsiniz.",
    locationResults: "konum seçeneği bulundu.",
    startDate: "İşe başlama tarihi",
    datePlaceholder: "GG/AA/YYYY",
    invalidDate: "GG/AA/YYYY biçiminde geçerli bir tarih girin.",
    narrative: "Açıklama ve maaş",
    description: "Ayrıntılı açıklama",
    descriptionPlaceholder:
      "Yat ortamını, görevi, çalışma düzenini ve beklentileri açıkla.",
    skillsCharacteristics: "Beceri ve karakter özellikleri",
    skills: "Beceriler",
    skillsHint: "Pozisyon için gerekli en fazla 5 beceri seçin.",
    characteristics: "Karakter özellikleri",
    characteristicsHint: "İdeal aday için en fazla 5 özellik seçin.",
    requirements: "Gereksinimler",
    certificatesDocuments: "Sertifikalar ve evraklar",
    certificatesDocumentsHint:
      "Pozisyon için gerekli denizcilik ve yatçılık evraklarını seçin.",
    visas: "Gerekli vizeler",
    visasHint: "Adayın sahip olması gereken vizeleri seçin.",
    selected: "seçili",
    maximumFive: "En fazla 5 seçim.",
    selectAllApplicable: "Uygun olanların tümünü seçebilirsiniz.",
    benefits: "Sunulan olanaklar",
    listHint: "Her satıra bir madde",
    benefitsPlaceholder: "Rotasyon programı\nSeyahat masrafları",
    salary: "Maaş",
    salaryVisible: "Ücreti herkese açık göster",
    salaryVisibleHelp:
      "Kapalı olduğunda tutarlar yalnız bu özel işveren alanında kalır.",
    salaryAmount: "Maaş",
    currency: "Para birimi",
    period: "Dönem",
    day: "Gün",
    week: "Hafta",
    month: "Ay",
    year: "Yıl",
    saveDraft: "Taslak kaydet",
    publish: "İlanı yayınla",
    saveLive: "Yayındaki değişiklikleri kaydet",
    cancelPost: "İlanı iptal et",
    cancelConfirm:
      "Bu ilanı iptal etmek istediğinize emin misiniz? İlan herkese açık iş ilanlarından kaldırılacak ve yeni başvuru kabul etmeyecek. Başvuru geçmişi korunacak.",
    saving: "Kaydediliyor…",
    viewLive: "Yayındaki ilanı gör",
    applications: "Başvurular",
    savedDraft: "Taslak kaydedildi.",
    savedPublished: "İş ilanı yayınlandı.",
    savedCancelled: "İş ilanı iptal edildi.",
    saveError: "İş ilanı kaydedilemedi.",
    changedElsewhere:
      "Bu sürüm güncel olmayabilir. Alanı yenileyip tekrar dene.",
    terminalTitle: "Bu ilan sona erdi",
    terminalExpired:
      "Bir aylık yayın süresi doldu. İlan artık herkese açık değil ve yeniden yayınlanamaz.",
    terminalCancelled:
      "Bu ilan iptal edildi ve artık herkese açık değil. Başvuru geçmişi korunmaya devam eder.",
    terminalClosed:
      "Bu ilan kapatıldı; artık düzenlenemez veya yeniden yayınlanamaz.",
    selectPost: "İlan seç",
  },
} as const;

export function JobPostsManager() {
  const { language } = useLanguage();
  const c = copy[language];
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [yachts, setYachts] = useState<VerifiedEmployerYacht[]>([]);
  const [jobs, setJobs] = useState<EmployerJobPost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<FormState>(() => emptyForm(""));
  const [openChoiceGroup, setOpenChoiceGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [applicationCounts, setApplicationCounts] = useState<
    Record<string, number>
  >({});

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) || null,
    [jobs, selectedId],
  );
  const selectedJobExpired = selectedJob
    ? isEmployerJobPostExpired(selectedJob)
    : false;
  const selectedJobTerminal = Boolean(
    selectedJob && (selectedJob.status === "closed" || selectedJobExpired),
  );
  const counts = useMemo(
    () => ({
      published: jobs.filter(
        (job) =>
          job.status === "published" && !isEmployerJobPostExpired(job),
      ).length,
      draft: jobs.filter((job) => job.status === "draft").length,
    }),
    [jobs],
  );

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setLoadError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/hiring/jobs")}`,
        );
        return;
      }

      try {
        const response = await fetch("/api/employer/job-posts", {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const result = (await response
          .json()
          .catch(() => null)) as WorkspaceResponse | null;

        if (response.status === 401) {
          window.location.replace(
            `/login?next=${encodeURIComponent("/hiring/jobs")}`,
          );
          return;
        }
        if (!response.ok || !result?.ok || !Array.isArray(result.yachts) || !Array.isArray(result.jobs)) {
          throw new Error(result?.error || "workspace_load_failed");
        }
        if (!active) return;

        const nextYachts = result.yachts;
        const nextJobs = result.jobs;
        setYachts(nextYachts);
        setJobs(nextJobs);
        setNotice(null);

        setSelectedId("");
        setForm(emptyForm(nextYachts[0]?.id || ""));
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "workspace_load_failed",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [reloadVersion]);

  useEffect(() => {
    if (!selectedJob || applicationCounts[selectedJob.id] !== undefined) return;
    let active = true;

    async function loadApplicationCount() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !selectedJob) return;

      const response = await fetch(
        `/api/employer/job-posts/${encodeURIComponent(selectedJob.id)}/applications?summary=1`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        total?: number;
      } | null;
      if (
        active &&
        response.ok &&
        result?.ok &&
        typeof result.total === "number"
      ) {
        setApplicationCounts((current) => ({
          ...current,
          [selectedJob.id]: result.total || 0,
        }));
      }
    }

    void loadApplicationCount();
    return () => {
      active = false;
    };
  }, [applicationCounts, selectedJob]);

  function startNewPost() {
    setSelectedId("");
    setForm(emptyForm(yachts[0]?.id || ""));
    setOpenChoiceGroup(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectJob(job: EmployerJobPost) {
    setSelectedId(job.id);
    setForm(formFromJob(job));
    setOpenChoiceGroup(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateForm<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveJob(targetStatus: JobPostStatus) {
    if (saving || selectedJobTerminal) return;

    const salaryAmount = inputNumber(form.salaryAmount);
    const yachtLength = inputYachtLength(form.yachtLength);
    const crewMemberCount = inputCrewMemberCount(form.crewMemberCount);
    const yachtBuildYear = inputYachtBuildYear(form.yachtBuildYear);
    if (!salaryAmount.ok) {
      setNotice({ tone: "error", message: c.saveError });
      return;
    }
    if (!crewMemberCount.ok) {
      setNotice({ tone: "error", message: c.crewMemberCountError });
      return;
    }
    if (!yachtBuildYear.ok) {
      setNotice({ tone: "error", message: c.yachtBuildYearError });
      return;
    }
    if (
      !yachtLength.ok ||
      (targetStatus === "published" &&
        (!form.yachtType || yachtLength.value === null))
    ) {
      setNotice({ tone: "error", message: c.yachtDetailsRequired });
      return;
    }
    if (
      targetStatus === "published" &&
      formRef.current &&
      !formRef.current.reportValidity()
    ) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/hiring/jobs")}`,
      );
      return;
    }

    setSaving(true);
    setNotice(null);

    const payload = {
      position: form.position,
      employmentType: form.employmentType,
      candidateType: form.candidateType,
      smokerPolicy: form.smokerPolicy,
      visibleTattooPolicy: form.visibleTattooPolicy,
      requiredLanguages: form.requiredLanguages,
      yachtBrand: form.yachtBrand.trim() || null,
      yachtFlagCountryCode: form.yachtFlagCountryCode || null,
      yachtBuildYear: yachtBuildYear.value,
      yachtType: form.yachtType || null,
      yachtLength: yachtLength.value,
      yachtLengthUnit:
        yachtLength.value === null ? null : form.yachtLengthUnit,
      crewMemberCount: crewMemberCount.value,
      minimumYachtExperience: form.minimumYachtExperience || null,
      location: form.location.trim(),
      startDate: form.startDate || null,
      summary: "",
      description: form.description.trim(),
      responsibilities: [],
      requirements: [],
      requiredSkills: form.requiredSkills,
      requiredCharacteristics: form.requiredCharacteristics,
      requiredCertificates: form.requiredCertificates,
      requiredVisas: form.requiredVisas,
      benefits: lines(form.benefits),
      salaryVisible: form.salaryVisible,
      salaryMin: salaryAmount.value,
      salaryMax: salaryAmount.value,
      salaryCurrency: form.salaryCurrency,
      salaryPeriod: form.salaryPeriod,
      showYachtName: true,
      status: targetStatus,
    };

    try {
      const endpoint = selectedJob
        ? `/api/employer/job-posts/${encodeURIComponent(selectedJob.id)}`
        : "/api/employer/job-posts";
      const response = await fetch(endpoint, {
        method: selectedJob ? "PATCH" : "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          selectedJob
            ? { ...payload, version: selectedJob.version }
            : { ...payload, yachtId: form.yachtId },
        ),
      });
      const result = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (response.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/hiring/jobs")}`,
        );
        return;
      }
      if (!response.ok || !result?.ok || !result.job) {
        throw new Error(
          response.status === 409
            ? result?.error || c.changedElsewhere
            : result?.error || c.saveError,
        );
      }

      const savedJob = result.job;
      setJobs((current) =>
        [savedJob, ...current.filter((job) => job.id !== savedJob.id)].sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        ),
      );
      setSelectedId(savedJob.id);
      setForm(formFromJob(savedJob));
      setNotice({
        tone: "success",
        message:
          savedJob.status === "published"
            ? c.savedPublished
            : savedJob.status === "closed"
              ? c.savedCancelled
              : c.savedDraft,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : c.saveError,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedJobTerminal) return;
    const status =
      selectedJob?.status === "published" ? "published" : "draft";
    void saveJob(status);
  }

  function cancelSelectedJob() {
    if (!selectedJob || selectedJobTerminal || saving) return;
    if (!window.confirm(c.cancelConfirm)) return;
    void saveJob("closed");
  }

  if (loading) {
    return <LoadingState label={c.loading} />;
  }

  if (loadError || (yachts.length === 0 && jobs.length > 0)) {
    return (
      <MessageState
        icon={<AlertCircle className="h-8 w-8" />}
        title={c.loadError}
        text={
          loadError && loadError !== "workspace_load_failed"
            ? loadError
            : c.loadError
        }
        action={c.retry}
        onAction={() => setReloadVersion((current) => current + 1)}
      />
    );
  }

  if (yachts.length === 0) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="bd-ocean-content mx-auto max-w-4xl">
          <section className="bd-glass-card-strong overflow-hidden rounded-[32px]">
            <div className="bd-brand-rule h-1.5" />
            <div className="p-7 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <ShieldCheck className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="bd-serif mt-6 text-4xl text-[#071f3c] sm:text-5xl">
                {c.accessRequired}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {c.accessRequiredText}
              </p>
              <Link
                href="/hiring"
                className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {c.reviewAccess}
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page min-h-screen overflow-x-hidden bg-slate-50 px-4 pb-24 pt-6 text-slate-900 sm:px-7 sm:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#071f3c] sm:text-4xl">
              {selectedJob ? c.editTitle : c.createTitle}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Metric label={c.live} value={counts.published} tone="emerald" />
              <Metric label={c.drafts} value={counts.draft} tone="amber" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/hiring"
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {c.back}
              </Link>
              <Link
                href="/jobs"
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-bold text-white transition hover:bg-cyan-800"
              >
                <Eye className="h-4 w-4" aria-hidden />
                {c.publicBoard}
              </Link>
          </div>
        </header>

        {notice ? (
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live={notice.tone === "error" ? "assertive" : "polite"}
            className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6 ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-rose-200 bg-rose-50 text-rose-950"
            }`}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            )}
            <span>{notice.message}</span>
          </div>
        ) : null}

        <div className="mt-4">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {jobs.length > 0 ? (
              <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {selectedJob ? (
                    <div>
                      <p data-i18n-ignore className="text-sm font-bold text-slate-800">
                        {selectedJob.position || selectedJob.title}
                      </p>
                      <p
                        data-i18n-ignore
                        aria-label={`${c.listingNumber} ${formatJobListingNumber(selectedJob.listingNumber)}`}
                        className="mt-1 font-mono text-[10px] font-black tracking-[0.12em] text-cyan-800"
                      >
                        {formatJobListingNumber(selectedJob.listingNumber)}
                      </p>
                    </div>
                  ) : (
                    <span />
                  )}
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                  <select
                    value={selectedId}
                    onChange={(event) => {
                      const jobId = event.target.value;
                      if (!jobId) {
                        startNewPost();
                        return;
                      }
                      const job = jobs.find((item) => item.id === jobId);
                      if (job) selectJob(job);
                    }}
                    disabled={saving}
                    aria-label={c.selectPost}
                    className="bd-focus min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 sm:w-64"
                  >
                    <option value="">{c.newPost}</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.position} ·{" "}
                        {formatJobListingNumber(job.listingNumber)}
                      </option>
                    ))}
                  </select>
                  {selectedJob ? (
                    <StatusBadge
                      status={selectedJob.status}
                      job={selectedJob}
                      c={c}
                    />
                  ) : null}
                </div>
                </div>
              </div>
            ) : null}

            <fieldset
              disabled={selectedJobTerminal}
              className="m-0 min-w-0 border-0 p-0"
            >
              <div className="space-y-4 bg-slate-50/70 p-4 sm:p-6">

              {yachts.length > 1 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800">
                      <LockKeyhole className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Field label={c.publishingAccount}>
                        <select
                          value={form.yachtId}
                          onChange={(event) =>
                            updateForm("yachtId", event.target.value)
                          }
                          disabled={saving || Boolean(selectedJob)}
                          className={inputClass}
                          required
                        >
                          {yachts.map((yacht) => (
                            <option key={yacht.id} value={yacht.id}>
                              {[yacht.name, yacht.model]
                                .filter(Boolean)
                                .join(" · ")}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <p className="mt-2 text-xs font-semibold leading-5 text-cyan-950/70">
                        {c.publishingAccountHelp}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <FormSection icon={<BriefcaseBusiness />} title={c.identity}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field label={c.position}>
                    <select
                      value={form.position}
                      onChange={(event) =>
                        updateForm("position", event.target.value)
                      }
                      disabled={saving}
                      className={inputClass}
                      required
                    >
                      <option value="">{c.positionPlaceholder}</option>
                      {positionSelectGroups.map((group) => (
                        <optgroup
                          key={group.department}
                          label={group.department}
                        >
                          {group.positions.map((position) => (
                            <option key={position} value={position}>
                              {position}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>

                  <Field label={c.employmentType}>
                    <select
                      value={form.employmentType}
                      onChange={(event) =>
                        updateForm(
                          "employmentType",
                          event.target
                            .value as FormState["employmentType"],
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                    >
                      {jobEmploymentTypes.map((type) => (
                        <option key={type} value={type}>
                          {c[type]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={c.teamCouple}>
                    <select
                      value={
                        form.candidateType === "individual" ? "no" : "yes"
                      }
                      onChange={(event) =>
                        updateForm(
                          "candidateType",
                          event.target.value === "yes" ? "team" : "individual",
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                    >
                      <option value="no">{c.no}</option>
                      <option value="yes">{c.yes}</option>
                    </select>
                  </Field>

                  <Field label={c.minimumYachtExperience}>
                    <select
                      value={form.minimumYachtExperience}
                      onChange={(event) =>
                        updateForm(
                          "minimumYachtExperience",
                          event.target.value as JobMinimumYachtExperience | "",
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                    >
                      <option value="">{c.minimumYachtExperiencePlaceholder}</option>
                      {jobMinimumYachtExperiences.map((experience) => (
                        <option key={experience} value={experience}>
                          {formatJobMinimumYachtExperience(experience, language)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <LocationSearchField
                    label={c.location}
                    value={form.location}
                    onChange={(value) =>
                      updateForm("location", value.slice(0, 120))
                    }
                    placeholder={c.locationPlaceholder}
                    searchingText={c.locationSearching}
                    noResultsText={c.locationNoResults}
                    resultsText={c.locationResults}
                    disabled={saving}
                    required
                    maxLength={120}
                    labelClassName={fieldLabelClass}
                  />
                  <DateTextField
                    label={c.startDate}
                    value={form.startDate}
                    onChange={(value) => updateForm("startDate", value)}
                    placeholder={c.datePlaceholder}
                    invalidText={c.invalidDate}
                    disabled={saving}
                    labelClassName={fieldLabelClass}
                  />
                </div>
              </FormSection>

              <FormSection
                icon={<UsersRound />}
                title={c.candidatePreferences}
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field label={c.smoker}>
                    <select
                      value={form.smokerPolicy}
                      onChange={(event) =>
                        updateForm(
                          "smokerPolicy",
                          event.target.value as JobSmokerPolicy,
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                    >
                      {jobSmokerPolicies.map((policy) => (
                        <option key={policy} value={policy}>
                          {formatJobSmokerPolicy(policy, language)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={c.visibleTattoos}>
                    <select
                      value={form.visibleTattooPolicy}
                      onChange={(event) =>
                        updateForm(
                          "visibleTattooPolicy",
                          event.target.value as JobVisibleTattooPolicy,
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                    >
                      {jobVisibleTattooPolicies.map((policy) => (
                        <option key={policy} value={policy}>
                          {formatJobVisibleTattooPolicy(policy, language)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="lg:col-span-2">
                    <JobChoiceField
                      title={c.requiredLanguages}
                      hint={c.languageHint}
                      options={jobRequiredLanguages}
                      value={form.requiredLanguages}
                      maxSelected={jobRequiredLanguages.length}
                      selectedLabel={c.selected}
                      maximumText={c.selectAllApplicable}
                      disabled={saving}
                      open={openChoiceGroup === "languages"}
                      onOpenChange={(open) =>
                        setOpenChoiceGroup(open ? "languages" : null)
                      }
                      formatOption={(option) =>
                        formatJobRequiredLanguage(option, language)
                      }
                      onChange={(value) => updateForm("requiredLanguages", value)}
                    />
                  </div>
                </div>

                <div className="mt-6 divide-y divide-slate-200 border-t border-slate-200 pt-2">
                  <JobChoiceField
                    title={c.skills}
                    hint={c.skillsHint}
                    options={jobSkillOptions}
                    value={form.requiredSkills}
                    maxSelected={maximumJobSkillSelections}
                    selectedLabel={c.selected}
                    maximumText={c.maximumFive}
                    disabled={saving}
                    open={openChoiceGroup === "skills"}
                    onOpenChange={(open) =>
                      setOpenChoiceGroup(open ? "skills" : null)
                    }
                    onChange={(value) => updateForm("requiredSkills", value)}
                  />
                  <JobChoiceField
                    title={c.characteristics}
                    hint={c.characteristicsHint}
                    options={jobCharacteristicOptions}
                    value={form.requiredCharacteristics}
                    maxSelected={maximumJobCharacteristicSelections}
                    selectedLabel={c.selected}
                    maximumText={c.maximumFive}
                    disabled={saving}
                    open={openChoiceGroup === "characteristics"}
                    onOpenChange={(open) =>
                      setOpenChoiceGroup(open ? "characteristics" : null)
                    }
                    onChange={(value) =>
                      updateForm("requiredCharacteristics", value)
                    }
                  />
                  <JobChoiceField
                    title={c.certificatesDocuments}
                    hint={c.certificatesDocumentsHint}
                    options={jobCertificateOptions}
                    value={form.requiredCertificates}
                    maxSelected={maximumJobCertificateSelections}
                    selectedLabel={c.selected}
                    maximumText={c.selectAllApplicable}
                    disabled={saving}
                    open={openChoiceGroup === "certificates"}
                    onOpenChange={(open) =>
                      setOpenChoiceGroup(open ? "certificates" : null)
                    }
                    onChange={(value) =>
                      updateForm("requiredCertificates", value)
                    }
                  />
                  <JobChoiceField
                    title={c.visas}
                    hint={c.visasHint}
                    options={jobVisaOptions}
                    value={form.requiredVisas}
                    maxSelected={maximumJobVisaSelections}
                    selectedLabel={c.selected}
                    maximumText={c.maximumFive}
                    disabled={saving}
                    open={openChoiceGroup === "visas"}
                    onOpenChange={(open) =>
                      setOpenChoiceGroup(open ? "visas" : null)
                    }
                    formatOption={formatJobVisa}
                    onChange={(value) => updateForm("requiredVisas", value)}
                  />
                </div>
              </FormSection>

              <FormSection icon={<Ship />} title={c.yachtDetails}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field label={c.yachtType}>
                    <select
                      value={form.yachtType}
                      onChange={(event) =>
                        updateForm(
                          "yachtType",
                          event.target.value as FormState["yachtType"],
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                      required
                    >
                      <option value="">{c.yachtTypePlaceholder}</option>
                      {jobYachtTypes.map((type) => (
                        <option key={type} value={type}>
                          {formatJobYachtType(type, language)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={c.yachtBrand}>
                    <input
                      type="text"
                      value={form.yachtBrand}
                      onChange={(event) =>
                        updateForm("yachtBrand", event.target.value.slice(0, 80))
                      }
                      maxLength={80}
                      disabled={saving}
                      className={inputClass}
                      placeholder={c.yachtBrandPlaceholder}
                    />
                  </Field>

                  <CountryFlagField
                    label={c.yachtFlag}
                    value={form.yachtFlagCountryCode}
                    placeholder={c.yachtFlagPlaceholder}
                    clearLabel={c.yachtFlagClear}
                    noResults={c.yachtFlagNoResults}
                    disabled={saving}
                    onChange={(value) =>
                      updateForm("yachtFlagCountryCode", value)
                    }
                  />

                  <Field label={c.yachtBuildYear}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      value={form.yachtBuildYear}
                      onChange={(event) =>
                        updateForm(
                          "yachtBuildYear",
                          event.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      maxLength={4}
                      disabled={saving}
                      className={inputClass}
                      placeholder={c.yachtBuildYearPlaceholder}
                    />
                  </Field>

                  <YachtSizeField
                    label={c.yachtLength}
                    value={form.yachtLength}
                    unit={form.yachtLengthUnit}
                    onChange={(value, unit) =>
                      setForm((current) => ({
                        ...current,
                        yachtLength: value,
                        yachtLengthUnit: unit,
                      }))
                    }
                    amountLabel={c.yachtLengthAmount}
                    unitLabel={c.yachtLengthUnit}
                    placeholder={c.yachtLengthPlaceholder}
                    feetOptionLabel="ft"
                    metresOptionLabel="m"
                    disabled={saving}
                    required
                    maxLength={6}
                    maxIntegerDigits={3}
                    labelClassName={fieldLabelClass}
                  />

                  <Field label={c.crewMemberCount}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.crewMemberCount}
                      onChange={(event) =>
                        updateForm(
                          "crewMemberCount",
                          event.target.value.replace(/\D/g, "").slice(0, 3),
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                      placeholder={c.crewMemberCountPlaceholder}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection icon={<FilePenLine />} title={c.narrative}>
                <div className="grid gap-5">
                  <Field label={c.description}>
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateForm(
                          "description",
                          event.target.value.slice(0, 8000),
                        )
                      }
                      maxLength={8000}
                      rows={7}
                      disabled={saving}
                      className={`${inputClass} py-3`}
                      placeholder={c.descriptionPlaceholder}
                    />
                  </Field>

                  <ListField
                    label={c.benefits}
                    hint={c.listHint}
                    value={form.benefits}
                    placeholder={c.benefitsPlaceholder}
                    disabled={saving}
                    onChange={(value) => updateForm("benefits", value)}
                  />

                  <div className="border-t border-slate-200 pt-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-950">
                          {c.salary}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {c.salaryVisibleHelp}
                        </p>
                      </div>
                      <Toggle
                        checked={form.salaryVisible}
                        onChange={(checked) =>
                          updateForm("salaryVisible", checked)
                        }
                        disabled={saving}
                        label={c.salaryVisible}
                      />
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <fieldset>
                        <legend className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                          {c.salaryAmount}
                        </legend>
                        <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-slate-100 has-[input:disabled]:opacity-65">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            aria-label={c.salaryAmount}
                            value={form.salaryAmount}
                            onChange={(event) =>
                              updateForm("salaryAmount", event.target.value)
                            }
                            disabled={saving}
                            className="min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                          />
                          <select
                            aria-label={c.currency}
                            value={form.salaryCurrency}
                            onChange={(event) =>
                              updateForm(
                                "salaryCurrency",
                                event.target.value as JobSalaryCurrencyOption,
                              )
                            }
                            disabled={saving}
                            className="bd-focus min-h-12 shrink-0 border-l border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800 disabled:cursor-not-allowed"
                          >
                            {jobSalaryCurrencyOptions.map((currency) => (
                              <option key={currency} value={currency}>
                                {formatSalaryCurrencyOption(currency)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </fieldset>
                      <Field label={c.period}>
                        <select
                          value={form.salaryPeriod}
                          onChange={(event) =>
                            updateForm(
                              "salaryPeriod",
                              event.target.value as FormState["salaryPeriod"],
                            )
                          }
                          disabled={saving}
                          className={inputClass}
                        >
                          {jobSalaryPeriods.map((period) => (
                            <option key={period} value={period}>
                              {c[period]}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>
              </FormSection>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                {selectedJobTerminal ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                      <XCircle className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {c.terminalTitle}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        {selectedJobExpired ||
                        selectedJob?.closureReason === "expired"
                          ? c.terminalExpired
                          : selectedJob?.closureReason === "cancelled"
                            ? c.terminalCancelled
                            : c.terminalClosed}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <ActionButton
                      label={
                        selectedJob?.status === "published"
                          ? c.saveLive
                          : c.publish
                      }
                      icon={<Send />}
                      primary
                      disabled={saving}
                      loading={saving}
                      onClick={() => void saveJob("published")}
                    />
                    {selectedJob?.status !== "published" ? (
                      <ActionButton
                        label={c.saveDraft}
                        icon={<Save />}
                        disabled={saving}
                        loading={saving}
                        onClick={() => void saveJob("draft")}
                      />
                    ) : null}

                    {selectedJob ? (
                      <ActionButton
                        label={c.cancelPost}
                        icon={<XCircle />}
                        danger
                        disabled={saving}
                        loading={false}
                        onClick={cancelSelectedJob}
                      />
                    ) : null}
                  </div>
                )}

                {selectedJob ? (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link
                      href={`/hiring/jobs/${encodeURIComponent(selectedJob.id)}/applications`}
                      className="bd-focus inline-flex min-h-11 w-fit items-center gap-2 rounded-xl text-sm font-black text-cyan-800 transition hover:text-cyan-950"
                    >
                      <UsersRound className="h-4 w-4" aria-hidden />
                      {c.applications}
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] text-cyan-900">
                        {applicationCounts[selectedJob.id] ?? "—"}
                      </span>
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>

                    {selectedJob.status === "published" &&
                    !selectedJobExpired ? (
                      <Link
                        href={`/jobs/${encodeURIComponent(selectedJob.id)}`}
                        className="bd-focus inline-flex min-h-11 w-fit items-center gap-2 rounded-xl text-sm font-black text-cyan-800 transition hover:text-cyan-950"
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        {c.viewLive}
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "bd-focus mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-950 transition placeholder:text-slate-400 hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-65";
const fieldLabelClass =
  "mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-slate-500";

function emptyForm(yachtId: string): FormState {
  return {
    yachtId,
    position: "",
    employmentType: "permanent",
    candidateType: "individual",
    smokerPolicy: "no_preference",
    visibleTattooPolicy: "no_preference",
    requiredLanguages: [],
    yachtBrand: "",
    yachtFlagCountryCode: "",
    yachtBuildYear: "",
    yachtType: "",
    yachtLength: "",
    yachtLengthUnit: "m",
    crewMemberCount: "",
    minimumYachtExperience: "",
    location: "",
    startDate: "",
    description: "",
    requiredSkills: [],
    requiredCharacteristics: [],
    requiredCertificates: [],
    requiredVisas: [],
    benefits: "",
    salaryVisible: false,
    salaryAmount: "",
    salaryCurrency: "EUR",
    salaryPeriod: "month",
  };
}

function formFromJob(job: EmployerJobPost): FormState {
  return {
    yachtId: job.yachtId,
    position: job.position,
    employmentType: job.employmentType,
    candidateType: job.candidateType,
    smokerPolicy: job.smokerPolicy,
    visibleTattooPolicy: job.visibleTattooPolicy,
    requiredLanguages: job.requiredLanguages,
    yachtBrand: job.yachtBrand || "",
    yachtFlagCountryCode: job.yachtFlagCountryCode || "",
    yachtBuildYear:
      job.yachtBuildYear === null ? "" : String(job.yachtBuildYear),
    yachtType: job.yachtType || "",
    yachtLength:
      job.yachtLength === null ? "" : String(job.yachtLength),
    yachtLengthUnit: job.yachtLengthUnit || "m",
    crewMemberCount:
      job.crewMemberCount === null ? "" : String(job.crewMemberCount),
    minimumYachtExperience: job.minimumYachtExperience || "",
    location: job.location,
    startDate: job.startDate || "",
    description: job.description,
    requiredSkills: job.requiredSkills,
    requiredCharacteristics: job.requiredCharacteristics,
    requiredCertificates: job.requiredCertificates,
    requiredVisas: job.requiredVisas,
    benefits: job.benefits.join("\n"),
    salaryVisible: job.salaryVisible,
    salaryAmount:
      job.salary?.min === null && job.salary?.max === null
        ? ""
        : String(job.salary?.min ?? job.salary?.max ?? ""),
    salaryCurrency: isJobSalaryCurrencyOption(job.salary?.currency)
      ? job.salary.currency
      : "EUR",
    salaryPeriod: job.salary?.period || "month",
  };
}

function formatSalaryCurrencyOption(currency: JobSalaryCurrencyOption) {
  const labels: Record<JobSalaryCurrencyOption, string> = {
    EUR: "EUR (€)",
    USD: "USD ($)",
    GBP: "GBP (£)",
    AUD: "AUD (A$)",
    TRY: "TL (TRY)",
  };
  return labels[currency];
}

function FormSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactElement;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h3 className="text-base font-black text-slate-950 sm:text-lg">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function JobChoiceField<Option extends string>({
  title,
  hint,
  options,
  value,
  maxSelected,
  selectedLabel,
  maximumText,
  disabled,
  open,
  onOpenChange,
  formatOption,
  onChange,
}: {
  title: string;
  hint: string;
  options: readonly Option[];
  value: Option[];
  maxSelected: number;
  selectedLabel: string;
  maximumText: string;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatOption?: (option: Option) => React.ReactNode;
  onChange: (value: Option[]) => void;
}) {
  function toggleOption(option: Option) {
    const selected = value.includes(option);
    if (!selected && value.length >= maxSelected) return;

    const nextValue = selected
      ? value.filter((item) => item !== option)
      : [...value, option];
    onChange(nextValue);
    if (!selected && nextValue.length >= maxSelected) onOpenChange(false);
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
        className="bd-focus flex min-h-14 w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-65"
      >
        <span className="min-w-0">
          <span className="block text-sm font-black text-slate-950">
            {title}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
            {hint}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-800">
            {value.length}/{maxSelected} {selectedLabel}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {value.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5 px-3 pb-1">
          {value.map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => toggleOption(item)}
              className="inline-flex min-h-10 items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-[#173f4a] transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-65"
            >
              <span data-i18n-ignore>
                {formatOption ? formatOption(item) : item}
              </span>
              <span aria-hidden className="text-xs leading-none">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="mt-2 max-h-[min(55vh,28rem)] overflow-y-auto overscroll-contain rounded-xl bg-slate-50 p-2.5">
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-3">
            {options.map((option) => {
              const selected = value.includes(option);
              const locked = !selected && value.length >= maxSelected;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled || locked}
                  onClick={() => toggleOption(option)}
                  data-i18n-ignore
                  className={`min-h-11 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition sm:text-sm ${
                    selected
                      ? "border-cyan-600 bg-cyan-600 text-white"
                      : locked
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-cyan-400"
                  }`}
                >
                  {formatOption ? formatOption(option) : option}
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-xs font-semibold text-slate-500">
            {maximumText}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ListField({
  label,
  hint,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">{hint}</span>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 8000))}
        maxLength={8000}
        rows={7}
        disabled={disabled}
        className={`${inputClass} py-3`}
        placeholder={placeholder}
      />
    </label>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  help,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  help?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="bd-focus mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-cyan-700"
      />
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        {help ? (
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {help}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function StatusBadge({
  status,
  job,
  c,
}: {
  status: JobPostStatus;
  job?: EmployerJobPost | null;
  c: (typeof copy)["en"] | (typeof copy)["tr"];
}) {
  const presentation = job
    ? isEmployerJobPostExpired(job)
      ? "expired"
      : job.status === "closed" && job.closureReason === "cancelled"
        ? "cancelled"
        : status
    : status;
  const styles = {
    draft: "border-amber-200 bg-amber-50 text-amber-800",
    published: "border-emerald-200 bg-emerald-50 text-emerald-800",
    closed: "border-slate-200 bg-slate-100 text-slate-600",
    expired: "border-rose-200 bg-rose-50 text-rose-800",
    cancelled: "border-slate-300 bg-slate-100 text-slate-700",
  };
  const labels = {
    draft: c.draft,
    published: c.published,
    closed: c.closedStatus,
    expired: c.expiredStatus,
    cancelled: c.cancelledStatus,
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${styles[presentation]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {labels[presentation]}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  primary = false,
  danger = false,
  disabled,
  loading,
  onClick,
}: {
  label: string;
  icon: React.ReactElement;
  primary?: boolean;
  danger?: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const tone = primary
    ? "border-[#071f3c] bg-[#071f3c] text-white hover:bg-cyan-800"
    : danger
      ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
      : "border-slate-200 bg-white text-[#071f3c] hover:border-cyan-300 hover:bg-cyan-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-black transition disabled:cursor-wait disabled:opacity-60 ${tone}`}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      )}
      {label}
    </button>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber";
}) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${classes[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.1em] opacity-65">
        {label}
      </p>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div
        className="bd-ocean-content flex min-h-[55vh] flex-col items-center justify-center text-center"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className="h-9 w-9 animate-spin text-cyan-700" aria-hidden />
        <p className="mt-4 text-sm font-black text-slate-600">{label}</p>
      </div>
    </main>
  );
}

function MessageState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-4xl">
        <section className="bd-glass-card-strong overflow-hidden rounded-[30px]">
          <div className="bd-brand-rule h-1.5" />
          <div className="p-7 sm:p-10">
            <span className="text-rose-600">{icon}</span>
            <h1 className="mt-5 text-3xl font-semibold text-slate-950">
              {title}
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
            <button
              type="button"
              onClick={onAction}
              className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {action}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function inputNumber(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) return { ok: true, value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 99_999_999.99) {
    return { ok: false };
  }
  return { ok: true, value: number };
}

function inputYachtLength(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) return { ok: true, value: null };
  const number = Number(value.replace(",", "."));
  const rounded = Math.round(number * 100) / 100;
  if (!Number.isFinite(number) || rounded <= 0 || rounded > 999) {
    return { ok: false };
  }
  return { ok: true, value: rounded };
}

function inputCrewMemberCount(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) return { ok: true, value: null };
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > 200) {
    return { ok: false };
  }
  return { ok: true, value: count };
}

function inputYachtBuildYear(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) return { ok: true, value: null };
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || year < 1800 || year > 2100) {
    return { ok: false };
  }
  return { ok: true, value: year };
}
