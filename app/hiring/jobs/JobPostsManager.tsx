"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  FilePenLine,
  LoaderCircle,
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
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";
import { DateTextField } from "../../components/DateTextField";
import { CountryFlagField } from "../../components/CountryFlagField";
import { useLanguage } from "../../components/LanguageProvider";
import { LocationSearchField } from "../../components/LocationSearchField";
import { YachtSizeField } from "../../components/YachtSizeField";
import {
  formatJobMinimumYachtExperience,
  formatJobRequiredLanguage,
  formatJobSalaryAmountInput,
  formatJobSalaryCurrencyOption,
  formatJobSalaryPeriod,
  formatJobSmokerPolicy,
  formatJobVisa,
  formatJobVisibleTattooPolicy,
  formatJobYachtProgram,
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
  jobYachtPrograms,
  jobYachtTypes,
  maximumJobCertificateSelections,
  maximumJobCharacteristicSelections,
  maximumJobSkillSelections,
  maximumJobVisaSelections,
  normalizeJobSalaryAmountInput,
  parseJobSalaryAmountInput,
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
  type JobYachtProgram,
  type JobYachtType,
} from "../../lib/jobPosts";
import { positionSelectGroups } from "../../lib/yachtOperations";
import { supabase } from "../../lib/supabase";

type WorkspaceResponse = {
  ok?: boolean;
  error?: string;
  capabilities?: {
    canPostJobs?: boolean;
  };
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
  position: string;
  employmentType: (typeof jobEmploymentTypes)[number] | "";
  candidateType: JobCandidateType;
  smokerPolicy: JobSmokerPolicy;
  visibleTattooPolicy: JobVisibleTattooPolicy;
  requiredLanguages: JobRequiredLanguage[];
  yachtBrand: string;
  yachtFlagCountryCode: string;
  yachtBuildYear: string;
  yachtType: JobYachtType | "";
  yachtProgram: JobYachtProgram | "";
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
  salaryAmount: string;
  salaryCurrency: JobSalaryCurrencyOption;
  salaryPeriod: (typeof jobSalaryPeriods)[number];
};

const copy = {
  en: {
    back: "My Job Postings & Hiring",
    loading: "Loading your job posting workspace…",
    loadError: "Your job posting workspace could not be loaded.",
    jobNotFound:
      "This job post is not available in your hiring workspace.",
    retry: "Try again",
    accessRequired: "Job posting is not available",
    accessRequiredText:
      "Job posts are available to eligible Captain, Owner and Management accounts. Review your account access and try again.",
    reviewAccess: "My Job Postings & Hiring",
    createTitle: "Create a job post",
    editTitle: "Edit job post",
    listingNumber: "Listing no.",
    status: "Status",
    draft: "Draft",
    published: "Published",
    closedStatus: "Closed",
    expiredStatus: "Expired",
    cancelledStatus: "Cancelled",
    requiredLegend: "Marked fields must be completed before publishing.",
    identity: "Job basics",
    position: "Position",
    positionPlaceholder: "Select a position",
    employmentType: "Employment type",
    employmentTypePlaceholder: "Select employment type",
    teamCouple: "Team / Couple",
    any: "Any",
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
    yachtProgram: "Yacht program",
    yachtProgramPlaceholder: "Select yacht program",
    yachtLength: "Yacht length",
    yachtLengthAmount: "Yacht length value",
    yachtLengthUnit: "Yacht length unit",
    yachtLengthPlaceholder: "e.g. 27",
    crewMemberCount: "Crew member count",
    crewMemberCountPlaceholder: "e.g. 12",
    crewMemberCountError:
      "Crew member count must be a whole number between 1 and 200.",
    publishRequirements:
      "Complete every field marked with * before publishing.",
    logistics: "Timing and location",
    location: "Location",
    locationPlaceholder: "Search location",
    locationSearching: "Searching locations…",
    locationNoResults: "No matching location found. You can keep your own text.",
    locationResults: "location options available.",
    startDate: "Job start date",
    datePlaceholder: "DD/MM/YYYY",
    invalidDate: "Enter a valid date in DD/MM/YYYY format.",
    narrative: "Description",
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
    salaryHelp: "Shown on the public job card. Maximum 1.000.000.",
    salaryAmount: "Salary",
    currency: "Currency",
    period: "Period",
    saveDraft: "Save draft",
    publish: "Publish role",
    saveLive: "Save live changes",
    cancelPost: "Cancel listing",
    cancelConfirm:
      "Cancel this listing? It will be removed from the public jobs board and will no longer accept applications. Application history will be preserved.",
    keepEditing: "Keep listing",
    confirmCancel: "Cancel listing",
    saving: "Saving…",
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
  },
  tr: {
    back: "İş İlanlarım ve İşe Alım",
    loading: "İş ilanı alanın yükleniyor…",
    loadError: "İş ilanı alanın yüklenemedi.",
    jobNotFound:
      "Bu iş ilanı, işe alım alanınızda bulunamadı.",
    retry: "Tekrar dene",
    accessRequired: "İlan yayınlama kullanılamıyor",
    accessRequiredText:
      "İş ilanları uygun Captain, Owner ve Management hesapları tarafından yayınlanabilir. Hesap erişiminizi kontrol edip yeniden deneyin.",
    reviewAccess: "İş İlanlarım ve İşe Alım",
    createTitle: "İş ilanı oluştur",
    editTitle: "İş ilanını düzenle",
    listingNumber: "İlan no:",
    status: "Durum",
    draft: "Taslak",
    published: "Yayında",
    closedStatus: "Kapalı",
    expiredStatus: "Süresi doldu",
    cancelledStatus: "İptal edildi",
    requiredLegend: "İşaretli alanlar yayınlamadan önce doldurulmalıdır.",
    identity: "Temel ilan bilgileri",
    position: "Pozisyon",
    positionPlaceholder: "Pozisyon seç",
    employmentType: "Çalışma biçimi",
    employmentTypePlaceholder: "Çalışma biçimi seç",
    teamCouple: "Team / Couple",
    any: "Tümü",
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
    yachtProgram: "Yat programı",
    yachtProgramPlaceholder: "Yat programını seç",
    yachtLength: "Yat uzunluğu",
    yachtLengthAmount: "Yat uzunluğu değeri",
    yachtLengthUnit: "Yat uzunluğu birimi",
    yachtLengthPlaceholder: "Örn. 27",
    crewMemberCount: "Mürettebat sayısı",
    crewMemberCountPlaceholder: "Örn. 12",
    crewMemberCountError:
      "Mürettebat sayısı 1 ile 200 arasında tam sayı olmalıdır.",
    publishRequirements:
      "Yayınlamadan önce * ile işaretlenen tüm alanları doldurun.",
    logistics: "Tarih ve konum",
    location: "Konum",
    locationPlaceholder: "Konum ara",
    locationSearching: "Konumlar aranıyor…",
    locationNoResults:
      "Eşleşen konum bulunamadı. Yazdığınız konumu kullanabilirsiniz.",
    locationResults: "konum seçeneği bulundu.",
    startDate: "İşe başlama tarihi",
    datePlaceholder: "GG/AA/YYYY",
    invalidDate: "GG/AA/YYYY biçiminde geçerli bir tarih girin.",
    narrative: "Açıklama",
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
    salaryHelp: "Public ilan kartında gösterilir. Maksimum 1.000.000.",
    salaryAmount: "Maaş",
    currency: "Para birimi",
    period: "Dönem",
    saveDraft: "Taslak kaydet",
    publish: "İlanı yayınla",
    saveLive: "Yayındaki değişiklikleri kaydet",
    cancelPost: "İlanı iptal et",
    cancelConfirm:
      "Bu ilanı iptal etmek istediğinize emin misiniz? İlan herkese açık iş ilanlarından kaldırılacak ve yeni başvuru kabul etmeyecek. Başvuru geçmişi korunacak.",
    keepEditing: "İlanı koru",
    confirmCancel: "İlanı iptal et",
    saving: "Kaydediliyor…",
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
  },
} as const;

export function JobPostsManager({ initialJobId = "" }: { initialJobId?: string }) {
  const { language } = useLanguage();
  const c = copy[language];
  const router = useRouter();
  const requestedJobId = initialJobId.trim().toLowerCase();
  const editorPath = requestedJobId
    ? `/hiring/jobs?job=${encodeURIComponent(requestedJobId)}`
    : "/hiring/jobs";
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [canPostJobs, setCanPostJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<EmployerJobPost | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [openChoiceGroup, setOpenChoiceGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const selectedJobExpired = selectedJob
    ? isEmployerJobPostExpired(selectedJob)
    : false;
  const selectedJobTerminal = Boolean(
    selectedJob && (selectedJob.status === "closed" || selectedJobExpired),
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
          `/login?next=${encodeURIComponent(editorPath)}`,
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
            `/login?next=${encodeURIComponent(editorPath)}`,
          );
          return;
        }
        if (
          !response.ok ||
          !result?.ok ||
          typeof result.capabilities?.canPostJobs !== "boolean" ||
          !Array.isArray(result.jobs)
        ) {
          throw new Error(result?.error || "workspace_load_failed");
        }
        if (!active) return;
        if (result.capabilities?.canPostJobs !== true) {
          router.replace("/hiring");
          return;
        }

        const nextJobs = result.jobs;
        const requestedJob = requestedJobId
          ? nextJobs.find((job) => job.id.toLowerCase() === requestedJobId) || null
          : null;
        if (requestedJobId && !requestedJob) {
          throw new Error("job_not_found");
        }

        setCanPostJobs(result.capabilities.canPostJobs);
        setSelectedJob(requestedJob);
        setNotice(null);
        setCancelDialogOpen(false);
        setOpenChoiceGroup(null);
        setForm(
          requestedJob
            ? formFromJob(requestedJob)
            : emptyForm(),
        );
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
  }, [editorPath, reloadVersion, requestedJobId, router]);

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
    if (!yachtLength.ok) {
      setNotice({ tone: "error", message: c.publishRequirements });
      return;
    }
    const publishFieldsComplete =
      Boolean(form.position) &&
      Boolean(form.employmentType) &&
      form.location.trim().length >= 2 &&
      Boolean(form.startDate) &&
      Boolean(form.yachtType) &&
      yachtLength.value !== null &&
      salaryAmount.value !== null &&
      salaryAmount.value > 0 &&
      form.description.trim().length >= 60;
    if (targetStatus === "published" && !publishFieldsComplete) {
      setNotice({ tone: "error", message: c.publishRequirements });
      formRef.current?.reportValidity();
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
        `/login?next=${encodeURIComponent(editorPath)}`,
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
      yachtProgram: form.yachtProgram || null,
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
      salaryMin: salaryAmount.value,
      salaryMax: salaryAmount.value,
      salaryCurrency: form.salaryCurrency,
      salaryPeriod: form.salaryPeriod,
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
            : payload,
        ),
      });
      const result = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (response.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent(editorPath)}`,
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

      router.replace("/hiring");
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
    setCancelDialogOpen(true);
  }

  if (loading) {
    return <LoadingState label={c.loading} />;
  }

  if (loadError) {
    return (
      <MessageState
        icon={<AlertCircle className="h-8 w-8" />}
        title={c.loadError}
        text={
          loadError === "job_not_found"
            ? c.jobNotFound
            : loadError && loadError !== "workspace_load_failed"
              ? loadError
              : c.loadError
        }
        action={loadError === "job_not_found" ? c.back : c.retry}
        onAction={() => {
          if (loadError === "job_not_found") {
            router.replace("/hiring");
            return;
          }
          setReloadVersion((current) => current + 1);
        }}
      />
    );
  }

  if (!canPostJobs) {
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
    <main className="bd-app-page bd-page-gutter min-h-screen overflow-x-hidden bg-slate-50 px-4 pb-24 pt-6 text-slate-900 sm:px-7 sm:pt-8 lg:px-10">
      <div className="bd-page-frame mx-auto w-full max-w-[1180px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#071f3c] sm:text-4xl">
              {selectedJob ? c.editTitle : c.createTitle}
            </h1>
          </div>

          <Link
            href="/hiring"
            className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {c.back}
          </Link>
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
            {selectedJob ? (
              <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  <StatusBadge
                    status={selectedJob.status}
                    job={selectedJob}
                    c={c}
                  />
                </div>
              </div>
            ) : null}

            <fieldset
              disabled={selectedJobTerminal}
              className="m-0 min-w-0 border-0 p-0"
            >
              <div className="space-y-4 bg-slate-50/70 p-4 sm:p-6">

              <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-500">
                <span aria-hidden className="text-sm font-black text-rose-600">*</span>
                <span>{c.requiredLegend}</span>
              </p>

              <FormSection icon={<BriefcaseBusiness />} title={c.identity}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field label={<RequiredFieldLabel label={c.position} />}>
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

                  <Field label={<RequiredFieldLabel label={c.employmentType} />}>
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
                      required
                    >
                      <option value="">{c.employmentTypePlaceholder}</option>
                      {jobEmploymentTypes.map((type) => (
                        <option key={type} value={type}>
                          {c[type]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={c.teamCouple}>
                    <select
                      value={teamCoupleSelection(form.candidateType)}
                      onChange={(event) =>
                        updateForm(
                          "candidateType",
                          candidateTypeFromTeamCoupleSelection(
                            event.target.value,
                          ),
                        )
                      }
                      disabled={saving}
                      className={inputClass}
                    >
                      <option value="any">{c.any}</option>
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
                    label={<RequiredFieldLabel label={c.location} />}
                    ariaLabel={c.location}
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
                    label={<RequiredFieldLabel label={c.startDate} />}
                    value={form.startDate}
                    onChange={(value) => updateForm("startDate", value)}
                    placeholder={c.datePlaceholder}
                    invalidText={c.invalidDate}
                    disabled={saving}
                    required
                    labelClassName={fieldLabelClass}
                  />

                  <div className="border-t border-slate-200 pt-5 lg:col-span-2">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-950">
                          {c.salary}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {c.salaryHelp}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <fieldset>
                        <legend className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                          <RequiredFieldLabel label={c.salaryAmount} />
                        </legend>
                        <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-slate-100 has-[input:disabled]:opacity-65">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9.]*"
                            maxLength={9}
                            autoComplete="off"
                            aria-label={c.salaryAmount}
                            value={form.salaryAmount}
                            onChange={(event) =>
                              updateForm(
                                "salaryAmount",
                                normalizeJobSalaryAmountInput(
                                  event.target.value,
                                ),
                              )
                            }
                            disabled={saving}
                            required
                            className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-400 focus-visible:bg-cyan-50/60 focus-visible:shadow-[inset_0_0_0_2px_#06b6d4] disabled:cursor-not-allowed sm:px-4"
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
                            className="min-h-12 shrink-0 border-l border-slate-200 bg-slate-50 px-1.5 text-xs font-black text-slate-800 outline-none focus-visible:bg-cyan-50 focus-visible:shadow-[inset_0_0_0_2px_#06b6d4] disabled:cursor-not-allowed sm:px-3 sm:text-sm"
                          >
                            {jobSalaryCurrencyOptions.map((currency) => (
                              <option key={currency} value={currency}>
                                {formatJobSalaryCurrencyOption(currency)}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={c.period}
                            value={form.salaryPeriod}
                            onChange={(event) =>
                              updateForm(
                                "salaryPeriod",
                                event.target.value as FormState["salaryPeriod"],
                              )
                            }
                            disabled={saving}
                            className="min-h-12 shrink-0 border-l border-slate-200 bg-slate-50 px-1.5 text-xs font-black text-slate-800 outline-none focus-visible:bg-cyan-50 focus-visible:shadow-[inset_0_0_0_2px_#06b6d4] disabled:cursor-not-allowed sm:px-3 sm:text-sm"
                          >
                            {jobSalaryPeriods.map((period) => (
                              <option key={period} value={period}>
                                {formatJobSalaryPeriod(period, language)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </fieldset>
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection icon={<Ship />} title={c.yachtDetails}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="grid content-start gap-5">
                    <Field label={<RequiredFieldLabel label={c.yachtType} />}>
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

                    <Field label={c.yachtProgram}>
                      <select
                        value={form.yachtProgram}
                        onChange={(event) =>
                          updateForm(
                            "yachtProgram",
                            event.target.value as FormState["yachtProgram"],
                          )
                        }
                        disabled={saving}
                        className={inputClass}
                      >
                        <option value="">{c.yachtProgramPlaceholder}</option>
                        {jobYachtPrograms.map((program) => (
                          <option key={program} value={program}>
                            {formatJobYachtProgram(program, language)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid content-start gap-5">
                    <Field label={c.yachtBrand}>
                      <input
                        type="text"
                        value={form.yachtBrand}
                        onChange={(event) =>
                          updateForm(
                            "yachtBrand",
                            event.target.value.slice(0, 80),
                          )
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
                  </div>

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
                    label={<RequiredFieldLabel label={c.yachtLength} />}
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
                          {policy === "no_preference"
                            ? c.any
                            : formatJobSmokerPolicy(policy, language)}
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
                          {policy === "no_preference"
                            ? c.any
                            : formatJobVisibleTattooPolicy(policy, language)}
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

              <FormSection icon={<FilePenLine />} title={c.narrative}>
                <div className="grid gap-5">
                  <Field label={<RequiredFieldLabel label={c.description} />}>
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateForm(
                          "description",
                          event.target.value.slice(0, 8000),
                        )
                      }
                      maxLength={8000}
                      minLength={60}
                      rows={7}
                      disabled={saving}
                      required
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
              </div>
              </div>
            </fieldset>
          </form>
        </div>
      </div>

      {cancelDialogOpen && selectedJob ? (
        <ConfirmationDialog
          title={c.cancelPost}
          message={c.cancelConfirm}
          confirmLabel={c.confirmCancel}
          cancelLabel={c.keepEditing}
          onCancel={() => setCancelDialogOpen(false)}
          onConfirm={() => {
            setCancelDialogOpen(false);
            void saveJob("closed");
          }}
        />
      ) : null}
    </main>
  );
}

const inputClass =
  "bd-focus mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-950 transition placeholder:text-slate-400 hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-65";
const fieldLabelClass =
  "mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-slate-500";

function emptyForm(): FormState {
  return {
    position: "",
    employmentType: "",
    candidateType: "any",
    smokerPolicy: "no_preference",
    visibleTattooPolicy: "no_preference",
    requiredLanguages: [],
    yachtBrand: "",
    yachtFlagCountryCode: "",
    yachtBuildYear: "",
    yachtType: "",
    yachtProgram: "",
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
    salaryAmount: "",
    salaryCurrency: "EUR",
    salaryPeriod: "month",
  };
}

function teamCoupleSelection(value: JobCandidateType) {
  if (value === "any") return "any";
  return value === "individual" ? "no" : "yes";
}

function candidateTypeFromTeamCoupleSelection(
  value: string,
): JobCandidateType {
  if (value === "yes") return "team";
  if (value === "no") return "individual";
  return "any";
}

function formFromJob(job: EmployerJobPost): FormState {
  return {
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
    yachtProgram: job.yachtProgram || "",
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
    salaryAmount:
      job.salary?.min === null && job.salary?.max === null
        ? ""
        : formatJobSalaryAmountInput(
            job.salary?.min ?? job.salary?.max ?? "",
          ),
    salaryCurrency: isJobSalaryCurrencyOption(job.salary?.currency)
      ? job.salary.currency
      : "EUR",
    salaryPeriod: job.salary?.period || "month",
  };
}

function RequiredFieldLabel({ label }: { label: string }) {
  return (
    <>
      {label}
      <span aria-hidden className="ml-1 text-rose-600">
        *
      </span>
    </>
  );
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
  label: React.ReactNode;
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
  const number = parseJobSalaryAmountInput(value);
  if (number === null) {
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
