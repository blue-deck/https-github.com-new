"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  ExternalLink,
  FileText,
  Globe2,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  JOB_EMPLOYMENT_OPTIONS,
  JOB_POSITIONS,
} from "../lib/jobs/constants";
import { supabase } from "../lib/supabase";
import {
  AdminEmployerReview,
  type EmployerReviewDecision,
} from "./AdminEmployerReview";

type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

type JobStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "paused"
  | "filled"
  | "closed"
  | "rejected"
  | "expired";

type EmployerProfile = {
  id: string;
  display_name: string;
  company_name: string | null;
  employer_type: string;
  country_code: string | null;
  description: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
};

type HiringYacht = {
  id: string;
  name: string;
  model: string | null;
  flag: string | null;
};

type HiringJob = {
  id: string;
  slug: string | null;
  title: string;
  position: string;
  department: string;
  employment_type: string;
  yacht_id: string | null;
  country_code: string | null;
  yacht_name: string | null;
  yacht_type: string | null;
  yacht_length_metres: number | null;
  yacht_program: string | null;
  location: string;
  rotation: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  certifications: string[];
  visas: string[];
  languages: string[];
  minimum_experience_years: number | null;
  application_instructions: string;
  status: JobStatus;
  salary_currency: string | null;
  salary_minimum: number | null;
  salary_maximum: number | null;
  salary_period: string | null;
  salary_visible: boolean;
  openings_count: number;
  application_count: number;
  application_deadline: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type EmployerDraft = {
  display_name: string;
  company_name: string;
  employer_type: string;
  country_code: string;
  description: string;
};

type JobDraft = {
  title: string;
  position: string;
  department: string;
  employment_type: string;
  yacht_id: string;
  location: string;
  country_code: string;
  yacht_name: string;
  yacht_type: string;
  yacht_length_metres: string;
  yacht_program: string;
  rotation: string;
  start_date: string;
  end_date: string;
  application_deadline: string;
  salary_currency: string;
  salary_minimum: string;
  salary_maximum: string;
  salary_period: string;
  salary_visible: boolean;
  openings_count: string;
  summary: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  certifications: string[];
  visas: string[];
  languages: string[];
  minimum_experience_years: string;
  application_instructions: string;
};

type JobIntent = "draft" | "publish";
type JobFilter = "all" | "live" | "draft" | "closed";
type JobListField =
  | "requirements"
  | "responsibilities"
  | "benefits"
  | "certifications"
  | "visas"
  | "languages";

const employerTypes = [
  { value: "yacht", label: "Yacht" },
  { value: "captain", label: "Captain" },
  { value: "owner", label: "Owner / family office" },
  { value: "management_company", label: "Yacht management company" },
  { value: "recruitment_agency", label: "Recruitment agency" },
  { value: "other", label: "Other maritime employer" },
];

const yachtTypes = [
  ["motor_yacht", "Motor yacht"],
  ["sailing_yacht", "Sailing yacht"],
  ["catamaran", "Catamaran"],
  ["motor_catamaran", "Motor catamaran"],
  ["gulet", "Gulet"],
  ["expedition_yacht", "Expedition yacht"],
  ["support_vessel", "Support vessel"],
  ["chase_boat", "Chase boat"],
  ["commercial_vessel", "Commercial vessel"],
  ["other", "Other"],
] as const;

const yachtPrograms = [
  ["private", "Private"],
  ["charter", "Charter"],
  ["private_charter", "Private / charter"],
  ["new_build", "New build"],
  ["refit", "Refit"],
  ["delivery", "Delivery"],
  ["yard_period", "Yard period"],
  ["race_regatta", "Race / regatta"],
  ["other", "Other"],
] as const;

const salaryPeriods = [
  ["hour", "Per hour"],
  ["day", "Per day"],
  ["week", "Per week"],
  ["month", "Per month"],
  ["year", "Per year"],
  ["contract", "Full contract"],
] as const;

const positionGroups = Array.from(
  new Set(JOB_POSITIONS.map((position) => position.department)),
).map((department) => ({
  department,
  positions: JOB_POSITIONS.filter(
    (position) => position.department === department,
  ),
}));

const initialEmployerDraft: EmployerDraft = {
  display_name: "",
  company_name: "",
  employer_type: "yacht",
  country_code: "",
  description: "",
};

const initialJobDraft: JobDraft = {
  title: "",
  position: "",
  department: "",
  employment_type: "permanent",
  yacht_id: "",
  location: "",
  country_code: "",
  yacht_name: "",
  yacht_type: "motor_yacht",
  yacht_length_metres: "",
  yacht_program: "private",
  rotation: "",
  start_date: "",
  end_date: "",
  application_deadline: "",
  salary_currency: "EUR",
  salary_minimum: "",
  salary_maximum: "",
  salary_period: "month",
  salary_visible: false,
  openings_count: "1",
  summary: "",
  description: "",
  requirements: [""],
  responsibilities: [""],
  benefits: [""],
  certifications: [""],
  visas: [""],
  languages: [""],
  minimum_experience_years: "",
  application_instructions: "",
};

const jobStatusLabels: Record<JobStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  published: "Live",
  paused: "Paused",
  filled: "Filled",
  closed: "Closed",
  rejected: "Needs changes",
  expired: "Expired",
};

const hiringLoginPath = `/login?next=${encodeURIComponent("/hiring")}`;

export function HiringClient() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(true);
  const [canReviewEmployers, setCanReviewEmployers] = useState(false);
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [yachts, setYachts] = useState<HiringYacht[]>([]);
  const [jobs, setJobs] = useState<HiringJob[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [employerDraft, setEmployerDraft] =
    useState<EmployerDraft>(initialEmployerDraft);
  const [savingEmployer, setSavingEmployer] = useState(false);
  const [employerEditorOpen, setEmployerEditorOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [jobDraft, setJobDraft] = useState<JobDraft>(initialJobDraft);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [savingJob, setSavingJob] = useState<JobIntent | null>(null);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");
  const employerEditorRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  const loadHiringDesk = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace(hiringLoginPath);
        return;
      }

      const response = await fetch("/api/hiring", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });
      const payload = await readPayload(response);
      setCanReviewEmployers(payload.can_review_employers === true);

      if (response.status === 401) {
        window.location.replace(hiringLoginPath);
        return;
      }

      if (
        response.status === 404 ||
        response.status === 503 ||
        payload.available === false
      ) {
        setAvailable(false);
        setEmployer(null);
        setYachts([]);
        setJobs([]);
        setNotice(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          payloadError(payload, "Your hiring desk could not be loaded."),
        );
      }

      setAvailable(true);
      setEmployer(normalizeEmployer(payload.employer));
      setYachts(normalizeYachts(payload.yachts));
      setJobs(normalizeJobs(payload.jobs));
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your hiring desk could not be loaded.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHiringDesk();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace(hiringLoginPath);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadHiringDesk]);

  const stats = useMemo(() => {
    const live = jobs.filter((job) => job.status === "published").length;
    const review = jobs.filter(
      (job) => job.status === "pending_review",
    ).length;
    const applications = jobs.reduce(
      (total, job) => total + job.application_count,
      0,
    );
    return { total: jobs.length, live, review, applications };
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    if (jobFilter === "all") return jobs;
    if (jobFilter === "live") {
      return jobs.filter((job) =>
        ["published", "pending_review", "paused"].includes(job.status),
      );
    }
    if (jobFilter === "draft") {
      return jobs.filter((job) =>
        ["draft", "rejected"].includes(job.status),
      );
    }
    return jobs.filter((job) =>
      ["filled", "closed", "expired"].includes(job.status),
    );
  }, [jobFilter, jobs]);

  const selectedYacht =
    yachts.find((yacht) => yacht.id === jobDraft.yacht_id) || null;
  const employerHasChanges = employer
    ? employerDraftChanged(employerDraft, employer)
    : false;
  const employerMaterialChanges = employer
    ? employerMaterialIdentityChanged(employerDraft, employer)
    : false;
  const employerVerified = employer?.verification_status === "verified";
  const publishingReady = employerVerified && Boolean(selectedYacht);
  const publishingIssue = !employerVerified
    ? yachts.length === 0
      ? "Complete employer verification and connect an owned yacht before publishing."
      : "Complete employer verification before publishing."
    : yachts.length === 0
      ? "Connect an owned yacht before publishing."
      : !selectedYacht
        ? "Select a connected yacht in section 02 before publishing."
        : "";

  function openEmployerEditor() {
    if (!employer) return;
    setEmployerDraft(employerToDraft(employer));
    setEmployerEditorOpen(true);
    setNotice(null);
    window.requestAnimationFrame(() => {
      employerEditorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function closeEmployerEditor() {
    if (savingEmployer) return;
    setEmployerEditorOpen(false);
    if (employer) setEmployerDraft(employerToDraft(employer));
  }

  function openBuilder(job?: HiringJob) {
    setEditingJobId(job?.id || null);
    setJobDraft(job ? jobToDraft(job) : initialJobDraft);
    setBuilderOpen(true);
    setNotice(null);
    window.requestAnimationFrame(() => {
      builderRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function openNewBuilder() {
    openBuilder();
  }

  function closeBuilder() {
    if (savingJob) return;
    setBuilderOpen(false);
    setEditingJobId(null);
    setJobDraft(initialJobDraft);
  }

  async function saveEmployer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const existingEmployer = employer;

    const displayName = employerDraft.display_name.trim();
    const countryCode = employerDraft.country_code.trim().toUpperCase();

    if (displayName.length < 2) {
      setNotice({
        tone: "error",
        message: "Add the professional name candidates should see.",
      });
      return;
    }
    if (countryCode && countryCode.length !== 2) {
      setNotice({
        tone: "error",
        message: "Country code must contain two letters, for example GB or TR.",
      });
      return;
    }

    setSavingEmployer(true);

    try {
      const session = await activeSession();
      if (!session) return;

      const response = await fetch("/api/hiring/employer", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          display_name: displayName,
          company_name: cleanOptional(employerDraft.company_name),
          employer_type: employerDraft.employer_type,
          country_code: countryCode || null,
          description: employerDraft.description.trim(),
        }),
      });
      const payload = await readPayload(response);

      if (response.status === 401) {
        window.location.replace(hiringLoginPath);
        return;
      }
      if (response.status === 404 || response.status === 503) {
        setAvailable(false);
        return;
      }
      if (!response.ok) {
        throw new Error(
          payloadError(payload, "Your employer profile could not be saved."),
        );
      }

      const savedEmployer = normalizeEmployer(payload.employer);
      if (savedEmployer) {
        setEmployer(savedEmployer);
        setEmployerDraft(employerToDraft(savedEmployer));
      } else {
        await loadHiringDesk(true);
      }
      setEmployerEditorOpen(false);

      setNotice({
        tone: "success",
        message: employerSaveSuccessMessage(
          existingEmployer?.verification_status || null,
          savedEmployer?.verification_status || null,
        ),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your employer profile could not be saved.",
      });
    } finally {
      setSavingEmployer(false);
    }
  }

  function updateJob<Key extends keyof JobDraft>(
    key: Key,
    value: JobDraft[Key],
  ) {
    setJobDraft((current) => ({ ...current, [key]: value }));
  }

  function selectPosition(position: string) {
    const match = JOB_POSITIONS.find((item) => item.title === position);
    setJobDraft((current) => ({
      ...current,
      position,
      department: match?.department || "",
      title:
        current.title.trim() || (position ? `${position} · Yacht role` : ""),
    }));
  }

  function selectYacht(yachtId: string) {
    const yacht = yachts.find((item) => item.id === yachtId);
    setJobDraft((current) => ({
      ...current,
      yacht_id: yachtId,
      yacht_name: yacht?.name || (yachtId ? current.yacht_name : ""),
    }));
  }

  function updateList(
    field: JobListField,
    index: number,
    value: string,
  ) {
    setJobDraft((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  }

  function addListRow(
    field: JobListField,
  ) {
    setJobDraft((current) => ({
      ...current,
      [field]: [...current[field], ""],
    }));
  }

  function removeListRow(
    field: JobListField,
    index: number,
  ) {
    setJobDraft((current) => {
      const next = current[field].filter(
        (_item, itemIndex) => itemIndex !== index,
      );
      return { ...current, [field]: next.length ? next : [""] };
    });
  }

  async function submitJob(intent: JobIntent) {
    setNotice(null);
    const validationError = validateJob(jobDraft, intent);
    if (validationError) {
      setNotice({ tone: "error", message: validationError });
      return;
    }

    setSavingJob(intent);

    try {
      const session = await activeSession();
      if (!session) return;

      const hasSalary =
        Boolean(jobDraft.salary_minimum.trim()) ||
        Boolean(jobDraft.salary_maximum.trim());
      const jobPayload = {
        title: jobDraft.title.trim(),
        position: jobDraft.position,
        department: jobDraft.department,
        employment_type: jobDraft.employment_type,
        yacht_id: jobDraft.yacht_id || null,
        location: jobDraft.location.trim(),
        country_code:
          jobDraft.country_code.trim().toUpperCase() || null,
        yacht_name: cleanOptional(jobDraft.yacht_name),
        yacht_type: jobDraft.yacht_type,
        yacht_length_metres: numberOrNull(
          jobDraft.yacht_length_metres,
        ),
        yacht_program: jobDraft.yacht_program || null,
        rotation: cleanOptional(jobDraft.rotation),
        start_date: jobDraft.start_date || null,
        end_date: jobDraft.end_date || null,
        application_deadline:
          jobDraft.application_deadline || null,
        salary_currency: hasSalary
          ? jobDraft.salary_currency.trim().toUpperCase()
          : null,
        salary_minimum: numberOrNull(jobDraft.salary_minimum),
        salary_maximum: numberOrNull(jobDraft.salary_maximum),
        salary_period: hasSalary ? jobDraft.salary_period : null,
        salary_visible: hasSalary && jobDraft.salary_visible,
        openings_count:
          Number.parseInt(jobDraft.openings_count, 10) || 1,
        summary: jobDraft.summary.trim(),
        description: jobDraft.description.trim(),
        requirements: cleanList(jobDraft.requirements),
        responsibilities: cleanList(jobDraft.responsibilities),
        benefits: cleanList(jobDraft.benefits),
        certifications: cleanList(jobDraft.certifications),
        visas: cleanList(jobDraft.visas),
        languages: cleanList(jobDraft.languages),
        minimum_experience_years: numberOrNull(
          jobDraft.minimum_experience_years,
        ),
        application_instructions:
          jobDraft.application_instructions.trim(),
      };
      const editId = editingJobId;
      const response = await fetch(
        editId
          ? `/api/hiring/jobs/${encodeURIComponent(editId)}`
          : "/api/hiring/jobs",
        {
        method: editId ? "PUT" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...jobPayload,
          ...(editId ? {} : { intent }),
        }),
      });
      let payload = await readPayload(response);

      if (response.status === 401) {
        window.location.replace(hiringLoginPath);
        return;
      }
      if (response.status === 503) {
        setAvailable(false);
        return;
      }
      if (!response.ok) {
        throw new Error(
          payloadError(
            payload,
            intent === "publish"
              ? "This role could not be submitted for publishing."
              : "This draft could not be saved.",
          ),
        );
      }

      if (editId && intent === "publish") {
        const publishResponse = await fetch(
          `/api/hiring/jobs/${encodeURIComponent(editId)}`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ status: "published" }),
          },
        );
        const publishPayload = await readPayload(publishResponse);
        if (!publishResponse.ok) {
          throw new Error(
            payloadError(
              publishPayload,
              "The updated draft was saved but could not be published.",
            ),
          );
        }
        payload = {
          ...payload,
          job: {
            ...(isRecord(payload.job) ? payload.job : {}),
            ...(isRecord(publishPayload.job) ? publishPayload.job : {}),
          },
        };
      }

      const savedJob = normalizeJob(payload.job);
      if (savedJob) {
        setJobs((current) => [
          savedJob,
          ...current.filter((job) => job.id !== savedJob.id),
        ]);
      } else {
        await loadHiringDesk(true);
      }

      setJobDraft(initialJobDraft);
      setBuilderOpen(false);
      setEditingJobId(null);
      setNotice({
        tone: "success",
        message:
          intent === "publish"
            ? editId
              ? "Role updated and published."
              : "Role published successfully and is now ready for candidates."
            : editId
              ? "Job draft updated safely."
              : "Job draft saved safely.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "This job could not be saved.",
      });
    } finally {
      setSavingJob(null);
    }
  }

  async function updateJobStatus(job: HiringJob, nextStatus: JobStatus) {
    if (
      ["filled", "closed"].includes(nextStatus) &&
      !window.confirm(
        nextStatus === "filled"
          ? "Mark this role as filled? It will leave the public job board."
          : "Close this role? It will leave the public job board.",
      )
    ) {
      return;
    }

    setUpdatingJobId(job.id);
    setNotice(null);

    try {
      const session = await activeSession();
      if (!session) return;

      const response = await fetch(
        `/api/hiring/jobs/${encodeURIComponent(job.id)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const payload = await readPayload(response);
      if (response.status === 401) {
        window.location.replace(hiringLoginPath);
        return;
      }
      if (response.status === 503) {
        setAvailable(false);
        return;
      }
      if (!response.ok) {
        throw new Error(
          payloadError(payload, "The role status could not be updated."),
        );
      }

      const returnedJob = isRecord(payload.job) ? payload.job : {};
      const updatedJob = normalizeJob({ ...job, ...returnedJob });
      if (updatedJob) {
        setJobs((current) =>
          current.map((item) =>
            item.id === updatedJob.id ? updatedJob : item,
          ),
        );
      } else {
        await loadHiringDesk(true);
      }
      setNotice({
        tone: "success",
        message: lifecycleSuccessMessage(nextStatus),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The role status could not be updated.",
      });
    } finally {
      setUpdatingJobId(null);
    }
  }

  function handleEmployerReviewDecision(
    decision: EmployerReviewDecision,
  ) {
    setEmployer((current) =>
      current?.id === decision.employerId
        ? {
            ...current,
            verification_status: decision.status,
            verified_at: decision.verifiedAt,
          }
        : current,
    );
  }

  if (loading) {
    return <HiringLoading />;
  }

  if (!available) {
    return (
      <HiringUnavailable
        refreshing={refreshing}
        onRetry={() => void loadHiringDesk(true)}
      />
    );
  }

  if (!employer) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-4 py-8 text-slate-900 sm:px-8 lg:px-10 lg:py-10">
        <div className="bd-ocean-content mx-auto max-w-7xl">
          <SetupHero />
          {notice ? <NoticeBanner notice={notice} /> : null}
          {canReviewEmployers ? (
            <AdminEmployerReview
              onDecision={handleEmployerReviewDecision}
            />
          ) : null}
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.65fr)]">
            <EmployerSetupForm
              draft={employerDraft}
              saving={savingEmployer}
              onChange={(key, value) =>
                setEmployerDraft((current) => ({
                  ...current,
                  [key]: value,
                }))
              }
              onSubmit={saveEmployer}
            />
            <SetupAssurance />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-4 py-8 text-slate-900 sm:px-8 lg:px-10 lg:py-10">
      <div className="bd-ocean-content mx-auto max-w-[1500px]">
        <HiringHero
          employer={employer}
          yachtCount={yachts.length}
          refreshing={refreshing}
          builderOpen={builderOpen}
          onRefresh={() => void loadHiringDesk(true)}
          onNewJob={openNewBuilder}
        />

        {notice ? <NoticeBanner notice={notice} /> : null}

        {canReviewEmployers ? (
          <AdminEmployerReview
            onDecision={handleEmployerReviewDecision}
          />
        ) : null}

        <section
          aria-label="Hiring statistics"
          className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <StatCard
            icon={BriefcaseBusiness}
            label="All roles"
            value={stats.total}
            note="Across every status"
          />
          <StatCard
            icon={Globe2}
            label="Live now"
            value={stats.live}
            note="Visible on job board"
          />
          <StatCard
            icon={Clock3}
            label="In review"
            value={stats.review}
            note="Awaiting publishing"
          />
          <StatCard
            icon={Users}
            label="Applications"
            value={stats.applications}
            note="Across your roles"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="bd-glass-card-strong rounded-[28px] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="bd-kicker">Publishing readiness</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#071f3c]">
                  Verification at a glance
                </h2>
              </div>
              <VerificationBadge status={employer.verification_status} />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <ReadinessRow
                ready={employerVerified}
                title="Employer identity"
                text={
                  employerVerified
                    ? "Verified and eligible to publish roles."
                    : verificationGuidance(employer.verification_status)
                }
              />
              <ReadinessRow
                ready={yachts.length > 0}
                title="Owned yacht connection"
                text={
                  yachts.length
                    ? `${yachts.length} yacht${yachts.length === 1 ? "" : "s"} available in this hiring desk.`
                    : "Connect an owned yacht before requesting publication."
                }
              />
            </div>
            {yachts.length > 0 &&
            ["unverified", "rejected"].includes(
              employer.verification_status,
            ) ? (
              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-[#073d55]">
                    Your yacht connection is ready for verification.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#416b7b]">
                    Review the public employer details, then send this identity
                    to BlueDeck for approval.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openEmployerEditor}
                  disabled={employerEditorOpen}
                  className="bd-primary-cta shrink-0 disabled:cursor-default disabled:opacity-55"
                >
                  <Send className="h-4 w-4" />
                  {employer.verification_status === "rejected"
                    ? "Resubmit for review"
                    : "Request review"}
                </button>
              </div>
            ) : null}
            {yachts.length === 0 ? (
              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold leading-6 text-amber-900">
                  Add the yacht you are hiring for, then return here to connect
                  it to a role.
                </p>
                <Link
                  href="/yachts"
                  className="bd-secondary-cta shrink-0 border-amber-300 bg-white text-amber-900 hover:border-amber-400"
                >
                  Connect a yacht
                  <Ship className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>

          <aside className="bd-glass-card rounded-[28px] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#071f3c] text-cyan-200">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7890a6]">
                  Hiring identity
                </p>
                <h2
                  data-i18n-ignore
                  className="mt-1 break-words text-xl font-black text-[#071f3c] [overflow-wrap:anywhere]"
                >
                  {employer.display_name}
                </h2>
                <p
                  data-i18n-ignore
                  className="mt-1 break-words text-sm font-semibold text-[#60778d] [overflow-wrap:anywhere]"
                >
                  {employer.company_name ||
                    humanize(employer.employer_type)}
                </p>
              </div>
            </div>
            {employer.description ? (
              <p
                data-i18n-ignore
                className="mt-5 line-clamp-3 break-words text-sm leading-7 text-[#60778d] [overflow-wrap:anywhere]"
              >
                {employer.description}
              </p>
            ) : null}
            <button
              type="button"
              onClick={openEmployerEditor}
              disabled={employerEditorOpen}
              className="bd-secondary-cta mt-5 w-full justify-center disabled:cursor-default disabled:opacity-55"
            >
              <Pencil className="h-4 w-4" />
              {employerEditorOpen
                ? "Employer editor open"
                : "Edit employer"}
            </button>
          </aside>
        </section>

        {employerEditorOpen ? (
          <div
            ref={employerEditorRef}
            className="mt-6 scroll-mt-28"
          >
            <EmployerSetupForm
              draft={employerDraft}
              saving={savingEmployer}
              editing
              verificationStatus={employer.verification_status}
              yachtConnected={yachts.length > 0}
              hasChanges={employerHasChanges}
              materialChanges={employerMaterialChanges}
              onChange={(key, value) =>
                setEmployerDraft((current) => ({
                  ...current,
                  [key]: value,
                }))
              }
              onSubmit={saveEmployer}
              onCancel={closeEmployerEditor}
            />
          </div>
        ) : null}

        {builderOpen ? (
          <div ref={builderRef} className="scroll-mt-28">
            <JobBuilder
              draft={jobDraft}
              employer={employer}
              yachts={yachts}
              selectedYacht={selectedYacht}
              publishingReady={publishingReady}
              publishingIssue={publishingIssue}
              editing={Boolean(editingJobId)}
              saving={savingJob}
              onClose={closeBuilder}
              onUpdate={updateJob}
              onPosition={selectPosition}
              onYacht={selectYacht}
              onListUpdate={updateList}
              onListAdd={addListRow}
              onListRemove={removeListRow}
              onSubmit={submitJob}
            />
          </div>
        ) : null}

        <JobsWorkspace
          jobs={visibleJobs}
          totalJobs={jobs.length}
          filter={jobFilter}
          onFilter={setJobFilter}
          updatingJobId={updatingJobId}
          onNewJob={openNewBuilder}
          onEdit={openBuilder}
          onStatus={updateJobStatus}
        />
      </div>
    </main>
  );
}

function HiringLoading() {
  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-[72vh] items-center justify-center px-5 py-12">
      <div className="bd-ocean-content flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-100 bg-white shadow-xl shadow-slate-900/8">
          <LoaderCircle className="h-7 w-7 animate-spin text-cyan-700" />
        </div>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-[#526b83]">
          Opening your hiring desk
        </p>
      </div>
    </main>
  );
}

function HiringUnavailable({
  refreshing,
  onRetry,
}: {
  refreshing: boolean;
  onRetry: () => void;
}) {
  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-4 py-10 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-5xl">
        <section className="bd-app-hero-dark overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              Hiring service status
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
              Your hiring desk is temporarily unavailable.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
              We could not securely load your hiring workspace just now. Your
              employer, yacht, role and candidate information remains protected
              and unchanged.
            </p>
          </div>
        </section>
        <section className="bd-glass-card-strong mt-6 rounded-[28px] p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[#071f3c]">
                Please try again shortly
              </h2>
              <p className="mt-4 max-w-2xl leading-8 text-[#5b7088]">
                Refresh the hiring desk to reconnect. If the issue continues,
                return to your dashboard and try again later; your existing
                yacht and crew workflows remain available.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <button
                type="button"
                onClick={onRetry}
                disabled={refreshing}
                className="bd-primary-cta disabled:cursor-not-allowed disabled:opacity-55"
              >
                {refreshing ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
                Retry hiring desk
              </button>
              <Link href="/dashboard" className="bd-secondary-cta">
                Back to dashboard
                <LayoutDashboard className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SetupHero() {
  return (
    <section className="bd-app-hero-dark overflow-hidden">
      <div className="relative z-10 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
          BlueDeck hiring desk
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
          Create the identity behind every great hire.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
          Candidates should always understand who is hiring. Set up your
          professional employer profile before creating yacht job drafts.
        </p>
      </div>
      <div className="relative z-10 hidden min-w-72 grid-cols-2 gap-3 lg:grid">
        <HeroProof icon={ShieldCheck} label="Account access" value="Secure workspace" />
        <HeroProof icon={Ship} label="Yacht context" value="Connected hiring" />
      </div>
    </section>
  );
}

function EmployerSetupForm({
  draft,
  saving,
  editing = false,
  verificationStatus = "unverified",
  yachtConnected = false,
  hasChanges = false,
  materialChanges = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: EmployerDraft;
  saving: boolean;
  editing?: boolean;
  verificationStatus?: VerificationStatus;
  yachtConnected?: boolean;
  hasChanges?: boolean;
  materialChanges?: boolean;
  onChange: (key: keyof EmployerDraft, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  const requestReviewReady =
    editing &&
    yachtConnected &&
    ["unverified", "rejected"].includes(verificationStatus);
  const noUsefulChange =
    editing && !hasChanges && !requestReviewReady;

  return (
    <form
      onSubmit={onSubmit}
      className="bd-glass-card-strong rounded-[28px] p-6 sm:p-9"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <p className="bd-kicker">
            {editing ? "Hiring identity" : "Step 01"}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071f3c]">
            {editing ? "Edit employer profile" : "Employer profile"}
          </h2>
          <p className="mt-2 leading-7 text-[#60778d]">
            {editing
              ? employerEditorIntroduction(verificationStatus)
              : "Use accurate professional details. BlueDeck controls verification separately from the information entered here."}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field label="Public hiring name" required>
          <input
            value={draft.display_name}
            onChange={(event) =>
              onChange("display_name", event.target.value)
            }
            maxLength={120}
            autoComplete="organization"
            placeholder="M/Y Aurora hiring team"
            className={controlClass}
            required
          />
        </Field>
        <Field label="Company name">
          <input
            value={draft.company_name}
            onChange={(event) =>
              onChange("company_name", event.target.value)
            }
            maxLength={160}
            autoComplete="organization"
            placeholder="Optional legal or management company"
            className={controlClass}
          />
        </Field>
        <Field label="Employer type" required>
          <select
            value={draft.employer_type}
            onChange={(event) =>
              onChange("employer_type", event.target.value)
            }
            className={controlClass}
          >
            {employerTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Country code" hint="Two letters, for example GB">
          <input
            value={draft.country_code}
            onChange={(event) =>
              onChange(
                "country_code",
                event.target.value.replace(/[^a-z]/gi, "").slice(0, 2),
              )
            }
            maxLength={2}
            autoComplete="country"
            placeholder="GB"
            className={`${controlClass} uppercase`}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Professional introduction"
            hint="Explain the yacht, operation or organisation without sharing confidential details."
          >
            <textarea
              value={draft.description}
              onChange={(event) =>
                onChange("description", event.target.value)
              }
              maxLength={1600}
              rows={5}
              placeholder="Tell candidates what makes your operation professional, safe and well organised."
              className={`${controlClass} resize-y`}
            />
          </Field>
        </div>
      </div>

      {editing &&
      verificationStatus === "verified" &&
      materialChanges ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-black">Material identity change detected</p>
            <p className="mt-1 text-sm leading-6 text-amber-900/80">
              Saving these public identity changes returns the employer profile
              to BlueDeck review. Public job visibility and new publishing
              pause until the new details are approved.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-4 border-t border-[#071f3c]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm leading-6 text-[#60778d]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
          {editing
            ? employerEditorGuidance(
                verificationStatus,
                yachtConnected,
                materialChanges,
              )
            : "Verification is completed by BlueDeck after reviewing the employer and connected yacht information."}
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {editing && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="bd-secondary-cta justify-center disabled:cursor-not-allowed disabled:opacity-55"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saving || noUsefulChange}
            className="bd-primary-cta justify-center disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : requestReviewReady ? (
              <Send className="h-5 w-5" />
            ) : editing ? (
              <Save className="h-5 w-5" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
            {employerSubmitLabel({
              editing,
              verificationStatus,
              yachtConnected,
            })}
          </button>
        </div>
      </div>
    </form>
  );
}

function SetupAssurance() {
  return (
    <aside className="bd-glass-card rounded-[28px] p-6 sm:p-8">
      <p className="bd-kicker">What happens next</p>
      <div className="mt-6 space-y-6">
        {[
          {
            icon: FileText,
            title: "Save structured drafts",
            text: "Prepare complete roles before anything becomes public.",
          },
          {
            icon: BadgeCheck,
            title: "Complete verification",
            text: "BlueDeck reviews employer status and yacht ownership before publication.",
          },
          {
            icon: Users,
            title: "Receive consistent applications",
            text: "Every candidate enters the same secure, structured hiring workflow.",
          },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071f3c] text-cyan-200">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8da0b1]">
                  0{index + 1}
                </p>
                <h3 className="mt-1 font-black text-[#071f3c]">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[#60778d]">
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function HiringHero({
  employer,
  yachtCount,
  refreshing,
  builderOpen,
  onRefresh,
  onNewJob,
}: {
  employer: EmployerProfile;
  yachtCount: number;
  refreshing: boolean;
  builderOpen: boolean;
  onRefresh: () => void;
  onNewJob: () => void;
}) {
  return (
    <section className="bd-app-hero-dark overflow-hidden">
      <div className="relative z-10 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
            BlueDeck hiring desk
          </p>
          <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/72">
            Private workspace
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
          Build the crew your yacht deserves.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
          Create clear roles, connect the right yacht and keep every hiring
          decision inside one professional BlueDeck workflow.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onNewJob}
            disabled={builderOpen}
            className="bd-primary-cta border border-cyan-300/30 bg-cyan-300 text-[#041024] hover:bg-cyan-200 disabled:cursor-default disabled:opacity-55"
          >
            <Plus className="h-5 w-5" />
            {builderOpen ? "Job builder open" : "Create a job"}
          </button>
          <Link
            href="/jobs"
            className="bd-secondary-cta border-white/18 bg-white/8 text-white hover:bg-white/14"
          >
            View public job board
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh hiring desk"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white/62 transition hover:bg-white/8 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>
      <div className="relative z-10 hidden min-w-72 grid-cols-2 gap-3 lg:grid">
        <HeroProof
          icon={BadgeCheck}
          label="Employer"
          value={verificationLabel(employer.verification_status)}
        />
        <HeroProof
          icon={Ship}
          label="Connected yachts"
          value={String(yachtCount)}
        />
      </div>
    </section>
  );
}

function HeroProof({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
      <Icon className="h-5 w-5 text-cyan-200" />
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-white/48">
        {label}
      </p>
      <p
        data-i18n-ignore
        className="mt-1 break-words text-sm font-black text-white [overflow-wrap:anywhere]"
      >
        {value}
      </p>
    </div>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const Icon =
    notice.tone === "success"
      ? CheckCircle2
      : notice.tone === "error"
        ? CircleAlert
        : ShieldCheck;
  const style =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : notice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-cyan-200 bg-cyan-50 text-cyan-900";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-6 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm font-bold ${style}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{notice.message}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="bd-glass-card rounded-[24px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7890a6]">
            {label}
          </p>
          <p
            data-i18n-ignore
            className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071f3c] sm:text-4xl"
          >
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 hidden text-xs font-semibold text-[#7890a6] sm:block">
        {note}
      </p>
    </article>
  );
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<VerificationStatus, string> = {
    verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    unverified: "border-slate-200 bg-slate-100 text-slate-700",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    suspended: "border-rose-200 bg-rose-50 text-rose-800",
  };
  const Icon = status === "verified" ? BadgeCheck : ShieldAlert;

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${styles[status]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {verificationLabel(status)}
    </span>
  );
}

function ReadinessRow({
  ready,
  title,
  text,
}: {
  ready: boolean;
  title: string;
  text: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        ready
          ? "border-emerald-200/80 bg-emerald-50/70"
          : "border-amber-200/80 bg-amber-50/70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            ready
              ? "bg-emerald-600 text-white"
              : "bg-amber-500 text-white"
          }`}
        >
          {ready ? (
            <Check className="h-4 w-4" />
          ) : (
            <Clock3 className="h-4 w-4" />
          )}
        </div>
        <div>
          <h3 className="font-black text-[#071f3c]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#60778d]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function JobBuilder({
  draft,
  employer,
  yachts,
  selectedYacht,
  publishingReady,
  publishingIssue,
  editing,
  saving,
  onClose,
  onUpdate,
  onPosition,
  onYacht,
  onListUpdate,
  onListAdd,
  onListRemove,
  onSubmit,
}: {
  draft: JobDraft;
  employer: EmployerProfile;
  yachts: HiringYacht[];
  selectedYacht: HiringYacht | null;
  publishingReady: boolean;
  publishingIssue: string;
  editing: boolean;
  saving: JobIntent | null;
  onClose: () => void;
  onUpdate: <Key extends keyof JobDraft>(
    key: Key,
    value: JobDraft[Key],
  ) => void;
  onPosition: (position: string) => void;
  onYacht: (yachtId: string) => void;
  onListUpdate: (
    field: JobListField,
    index: number,
    value: string,
  ) => void;
  onListAdd: (
    field: JobListField,
  ) => void;
  onListRemove: (
    field: JobListField,
    index: number,
  ) => void;
  onSubmit: (intent: JobIntent) => void;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[30px] border border-[#071f3c]/10 bg-white/92 shadow-2xl shadow-slate-900/8">
      <header className="flex flex-col gap-5 border-b border-[#071f3c]/10 bg-[#071f3c] px-6 py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
            {editing ? "Edit private job draft" : "Professional job builder"}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
            {editing
              ? "Refine every detail before the role goes live."
              : "Create a role candidates can trust."}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={Boolean(saving)}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/14 bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/14 disabled:opacity-50 sm:self-auto"
        >
          <X className="h-4 w-4" />
          {editing ? "Close editor" : "Close builder"}
        </button>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="min-w-0 p-5 sm:p-8">
          <BuilderSection
            number="01"
            icon={BriefcaseBusiness}
            title="Role and employment"
            intro="Start with a precise title and the onboard position BlueDeck uses to set the department automatically."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Job title" required>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      onUpdate("title", event.target.value)
                    }
                    maxLength={160}
                    placeholder="Chief Stewardess for 55m private motor yacht"
                    className={controlClass}
                  />
                </Field>
              </div>
              <Field label="Position" required>
                <select
                  value={draft.position}
                  onChange={(event) => onPosition(event.target.value)}
                  className={controlClass}
                >
                  <option value="">Select onboard position</option>
                  {positionGroups.map((group) => (
                    <optgroup
                      key={group.department}
                      label={group.department}
                    >
                      {group.positions.map((position) => (
                        <option key={position.title} value={position.title}>
                          {position.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Department" hint="Set automatically">
                <input
                  value={draft.department}
                  readOnly
                  placeholder="Choose a position first"
                  className={`${controlClass} bg-[#eef4f8] text-[#526b83]`}
                />
              </Field>
              <Field label="Employment type" required>
                <select
                  value={draft.employment_type}
                  onChange={(event) =>
                    onUpdate("employment_type", event.target.value)
                  }
                  className={controlClass}
                >
                  {JOB_EMPLOYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Open positions">
                <input
                  type="number"
                  value={draft.openings_count}
                  onChange={(event) =>
                    onUpdate("openings_count", event.target.value)
                  }
                  min={1}
                  max={100}
                  inputMode="numeric"
                  className={controlClass}
                />
              </Field>
            </div>
          </BuilderSection>

          <BuilderSection
            number="02"
            icon={Ship}
            title="Yacht and location"
            intro="Connect the yacht you are hiring for, then describe the vessel and work location accurately."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Connected BlueDeck yacht"
                  hint="A connected yacht is required before this role can be published."
                >
                  <select
                    value={draft.yacht_id}
                    onChange={(event) => onYacht(event.target.value)}
                    className={controlClass}
                  >
                    <option value="">No connected yacht selected</option>
                    {yachts.map((yacht) => (
                      <option key={yacht.id} value={yacht.id}>
                        {[
                          yacht.name,
                          yacht.model,
                          yacht.flag ? `Flag: ${yacht.flag}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Yacht name">
                <input
                  value={draft.yacht_name}
                  onChange={(event) =>
                    onUpdate("yacht_name", event.target.value)
                  }
                  maxLength={160}
                  placeholder="M/Y Aurora"
                  className={controlClass}
                />
              </Field>
              <Field label="Yacht type" required>
                <select
                  value={draft.yacht_type}
                  onChange={(event) =>
                    onUpdate("yacht_type", event.target.value)
                  }
                  className={controlClass}
                >
                  {yachtTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Length overall" hint="Metres">
                <input
                  type="number"
                  value={draft.yacht_length_metres}
                  onChange={(event) =>
                    onUpdate("yacht_length_metres", event.target.value)
                  }
                  min={1}
                  max={300}
                  step="0.1"
                  inputMode="decimal"
                  placeholder="55"
                  className={controlClass}
                />
              </Field>
              <Field label="Yacht programme">
                <select
                  value={draft.yacht_program}
                  onChange={(event) =>
                    onUpdate("yacht_program", event.target.value)
                  }
                  className={controlClass}
                >
                  {yachtPrograms.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Role location" required>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7890a6]" />
                  <input
                    value={draft.location}
                    onChange={(event) =>
                      onUpdate("location", event.target.value)
                    }
                    maxLength={160}
                    placeholder="Antibes, France"
                    className={`${controlClass} pl-10`}
                  />
                </div>
              </Field>
              <Field label="Country code" hint="Two letters">
                <input
                  value={draft.country_code}
                  onChange={(event) =>
                    onUpdate(
                      "country_code",
                      event.target.value
                        .replace(/[^a-z]/gi, "")
                        .slice(0, 2),
                    )
                  }
                  maxLength={2}
                  placeholder="FR"
                  className={`${controlClass} uppercase`}
                />
              </Field>
            </div>
          </BuilderSection>

          <BuilderSection
            number="03"
            icon={CalendarDays}
            title="Dates, rotation and salary"
            intro="Clear expectations reduce unsuitable applications and make the role easier to compare."
          >
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Start date">
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(event) =>
                    onUpdate("start_date", event.target.value)
                  }
                  className={controlClass}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  value={draft.end_date}
                  onChange={(event) =>
                    onUpdate("end_date", event.target.value)
                  }
                  min={draft.start_date || undefined}
                  className={controlClass}
                />
              </Field>
              <Field label="Application deadline">
                <input
                  type="date"
                  value={draft.application_deadline}
                  onChange={(event) =>
                    onUpdate(
                      "application_deadline",
                      event.target.value,
                    )
                  }
                  className={controlClass}
                />
              </Field>
              <Field label="Rotation / schedule">
                <input
                  value={draft.rotation}
                  onChange={(event) =>
                    onUpdate("rotation", event.target.value)
                  }
                  maxLength={100}
                  placeholder="2:2, 10 weeks on/off..."
                  className={controlClass}
                />
              </Field>
              <Field label="Minimum salary">
                <input
                  type="number"
                  value={draft.salary_minimum}
                  onChange={(event) =>
                    onUpdate("salary_minimum", event.target.value)
                  }
                  min={0}
                  step="1"
                  inputMode="decimal"
                  placeholder="4500"
                  className={controlClass}
                />
              </Field>
              <Field label="Maximum salary">
                <input
                  type="number"
                  value={draft.salary_maximum}
                  onChange={(event) =>
                    onUpdate("salary_maximum", event.target.value)
                  }
                  min={0}
                  step="1"
                  inputMode="decimal"
                  placeholder="5500"
                  className={controlClass}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={draft.salary_currency}
                  onChange={(event) =>
                    onUpdate("salary_currency", event.target.value)
                  }
                  className={controlClass}
                >
                  {["EUR", "USD", "GBP", "AUD", "NZD", "AED"].map(
                    (currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Salary period">
                <select
                  value={draft.salary_period}
                  onChange={(event) =>
                    onUpdate("salary_period", event.target.value)
                  }
                  className={controlClass}
                >
                  {salaryPeriods.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-2xl border border-[#071f3c]/12 bg-[#f5f8fb] px-4 py-3 transition hover:border-cyan-400">
                <input
                  type="checkbox"
                  checked={draft.salary_visible}
                  onChange={(event) =>
                    onUpdate("salary_visible", event.target.checked)
                  }
                  className="h-5 w-5 rounded border-slate-300 accent-cyan-700"
                />
                <span>
                  <span className="block text-sm font-black text-[#071f3c]">
                    Include salary in listing
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#60778d]">
                    The range will be published for candidates.
                  </span>
                </span>
              </label>
            </div>
          </BuilderSection>

          <BuilderSection
            number="04"
            icon={FileText}
            title="Role story"
            intro="Write for a qualified candidate: concise first, complete second."
          >
            <div className="grid gap-5">
              <Field
                label="Short summary"
                hint={`${draft.summary.length}/500 · Used on job cards`}
                required
              >
                <textarea
                  value={draft.summary}
                  onChange={(event) =>
                    onUpdate("summary", event.target.value)
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="A concise overview of the yacht, programme, team and ideal candidate."
                  className={`${controlClass} resize-y`}
                />
              </Field>
              <Field
                label="Full description"
                hint="Describe the operation, team culture, itinerary and role context."
                required
              >
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    onUpdate("description", event.target.value)
                  }
                  maxLength={8000}
                  rows={8}
                  placeholder="Give candidates the information they need to make an informed professional decision."
                  className={`${controlClass} resize-y`}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
                <Field label="Minimum experience" hint="Years">
                  <input
                    type="number"
                    value={draft.minimum_experience_years}
                    onChange={(event) =>
                      onUpdate(
                        "minimum_experience_years",
                        event.target.value,
                      )
                    }
                    min={0}
                    max={80}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="3"
                    className={controlClass}
                  />
                </Field>
                <Field
                  label="Application instructions"
                  hint="Optional final note shown to candidates"
                >
                  <textarea
                    value={draft.application_instructions}
                    onChange={(event) =>
                      onUpdate(
                        "application_instructions",
                        event.target.value,
                      )
                    }
                    maxLength={3000}
                    rows={3}
                    placeholder="Add any role-specific application guidance without requesting sensitive information."
                    className={`${controlClass} resize-y`}
                  />
                </Field>
              </div>
            </div>
          </BuilderSection>

          <BuilderSection
            number="05"
            icon={ListChecks}
            title="Structured expectations"
            intro="One clear item per row makes the listing easier to scan and keeps applications relevant."
            last
          >
            <div className="grid gap-6">
              <ListEditor
                label="Responsibilities"
                values={draft.responsibilities}
                placeholder="Lead and mentor the interior team"
                required
                onUpdate={(index, value) =>
                  onListUpdate("responsibilities", index, value)
                }
                onAdd={() => onListAdd("responsibilities")}
                onRemove={(index) =>
                  onListRemove("responsibilities", index)
                }
              />
              <ListEditor
                label="Requirements"
                values={draft.requirements}
                placeholder="Previous experience on 50m+ private yachts"
                required
                onUpdate={(index, value) =>
                  onListUpdate("requirements", index, value)
                }
                onAdd={() => onListAdd("requirements")}
                onRemove={(index) =>
                  onListRemove("requirements", index)
                }
              />
              <ListEditor
                label="Required certifications"
                values={draft.certifications}
                placeholder="STCW Basic Safety Training"
                onUpdate={(index, value) =>
                  onListUpdate("certifications", index, value)
                }
                onAdd={() => onListAdd("certifications")}
                onRemove={(index) =>
                  onListRemove("certifications", index)
                }
              />
              <ListEditor
                label="Benefits"
                values={draft.benefits}
                placeholder="Flights, medical cover or training allowance"
                onUpdate={(index, value) =>
                  onListUpdate("benefits", index, value)
                }
                onAdd={() => onListAdd("benefits")}
                onRemove={(index) =>
                  onListRemove("benefits", index)
                }
              />
              <ListEditor
                label="Languages"
                values={draft.languages}
                placeholder="English · professional working proficiency"
                onUpdate={(index, value) =>
                  onListUpdate("languages", index, value)
                }
                onAdd={() => onListAdd("languages")}
                onRemove={(index) =>
                  onListRemove("languages", index)
                }
              />
              <ListEditor
                label="Visa / work-right requirements"
                values={draft.visas}
                placeholder="Schengen visa or right to work in the EU"
                onUpdate={(index, value) =>
                  onListUpdate("visas", index, value)
                }
                onAdd={() => onListAdd("visas")}
                onRemove={(index) =>
                  onListRemove("visas", index)
                }
              />
            </div>
          </BuilderSection>
        </div>

        <aside className="border-t border-[#071f3c]/10 bg-[#f3f7fb] p-5 sm:p-8 xl:border-l xl:border-t-0">
          <div className="xl:sticky xl:top-28">
            <JobPreview
              draft={draft}
              employer={employer}
              selectedYacht={selectedYacht}
              publishingReady={publishingReady}
              publishingIssue={publishingIssue}
            />
            <div className="mt-5 rounded-[24px] border border-[#071f3c]/10 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#7890a6]">
                Save and publish
              </p>
              <p className="mt-3 text-sm leading-6 text-[#60778d]">
                Drafts stay private. Publishing requires a verified employer
                and a connected yacht.
              </p>
              {!publishingReady ? (
                <div
                  id="job-publishing-requirements"
                  className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-5">
                      {publishingIssue}
                    </p>
                    {yachts.length === 0 ? (
                      <Link
                        href="/yachts"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-black underline decoration-amber-400 underline-offset-4"
                      >
                        Connect a yacht
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => onSubmit("publish")}
                  disabled={Boolean(saving) || !publishingReady}
                  aria-describedby={
                    publishingReady
                      ? undefined
                      : "job-publishing-requirements"
                  }
                  title={publishingReady ? undefined : publishingIssue}
                  className="bd-primary-cta w-full justify-center disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {saving === "publish" ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  {editing ? "Save and publish" : "Publish role"}
                </button>
                <button
                  type="button"
                  onClick={() => onSubmit("draft")}
                  disabled={Boolean(saving)}
                  className="bd-secondary-cta w-full justify-center disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {saving === "draft" ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {editing ? "Update private draft" : "Save private draft"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function BuilderSection({
  number,
  icon: Icon,
  title,
  intro,
  last = false,
  children,
}: {
  number: string;
  icon: typeof BriefcaseBusiness;
  title: string;
  intro: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`grid gap-6 py-8 first:pt-0 lg:grid-cols-[190px_minmax(0,1fr)] ${
        last ? "" : "border-b border-[#071f3c]/10"
      }`}
    >
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8da0b1]">
            {number}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-black tracking-[-0.02em] text-[#071f3c]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#60778d]">{intro}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function JobPreview({
  draft,
  employer,
  selectedYacht,
  publishingReady,
  publishingIssue,
}: {
  draft: JobDraft;
  employer: EmployerProfile;
  selectedYacht: HiringYacht | null;
  publishingReady: boolean;
  publishingIssue: string;
}) {
  const requirements = cleanList(draft.requirements);
  const completed = [
    draft.title,
    draft.position,
    draft.department,
    draft.location,
    draft.yacht_type,
    draft.summary,
    draft.description,
    cleanList(draft.responsibilities).length ? "yes" : "",
    requirements.length ? "yes" : "",
  ].filter(Boolean).length;
  const percentage = Math.round((completed / 9) * 100);

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#071f3c]/10 bg-white shadow-xl shadow-slate-900/6">
      <div className="bg-[#071f3c] p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200">
            Live preview
          </p>
          <span className="text-xs font-black text-white/72">
            {percentage}% complete
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-cyan-300 transition-[width] duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
            {draft.employment_type
              ? humanize(draft.employment_type)
              : "Employment"}
          </span>
          {draft.department ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
              {draft.department}
            </span>
          ) : null}
        </div>
        <h3
          data-i18n-ignore
          className="mt-5 break-words text-2xl font-black tracking-[-0.035em] text-[#071f3c] [overflow-wrap:anywhere]"
        >
          {draft.title.trim() || "Your yacht role title"}
        </h3>
        <p
          data-i18n-ignore
          className="mt-2 break-words text-sm font-bold text-cyan-800 [overflow-wrap:anywhere]"
        >
          {[employer.display_name, draft.position]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-5 space-y-2 text-sm font-semibold text-[#60778d]">
          <PreviewLine
            icon={Ship}
            value={
              selectedYacht?.name ||
              draft.yacht_name ||
              "Yacht not selected"
            }
          />
          <PreviewLine
            icon={MapPin}
            value={draft.location || "Location not added"}
          />
          <PreviewLine
            icon={Coins}
            value={previewSalary(draft)}
          />
          <PreviewLine
            icon={CalendarDays}
            value={
              draft.start_date
                ? `Starts ${formatDate(draft.start_date)}`
                : "Start date flexible"
            }
          />
        </div>
        <p
          data-i18n-ignore
          className="mt-5 line-clamp-4 break-words text-sm leading-6 text-[#60778d] [overflow-wrap:anywhere]"
        >
          {draft.summary.trim() ||
            "Your concise role summary will appear here."}
        </p>
        {requirements.length ? (
          <div className="mt-5 border-t border-[#071f3c]/10 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#7890a6]">
              Key requirements
            </p>
            <ul className="mt-3 space-y-2">
              {requirements.slice(0, 3).map((requirement) => (
                <li
                  key={requirement}
                  className="flex items-start gap-2 text-xs font-semibold leading-5 text-[#60778d]"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" />
                  <span
                    data-i18n-ignore
                    className="min-w-0 break-words [overflow-wrap:anywhere]"
                  >
                    {requirement}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div
        className={`flex items-center gap-2 border-t px-5 py-4 text-xs font-black ${
          publishingReady
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {publishingReady ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <ShieldAlert className="h-4 w-4" />
        )}
        {publishingReady
          ? "Publishing context connected"
          : publishingIssue}
      </div>
    </div>
  );
}

function PreviewLine({
  icon: Icon,
  value,
}: {
  icon: typeof Ship;
  value: string;
}) {
  return (
    <p className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
      <span
        data-i18n-ignore
        className="min-w-0 break-words [overflow-wrap:anywhere]"
      >
        {value}
      </span>
    </p>
  );
}

function ListEditor({
  label,
  values,
  placeholder,
  required = false,
  onUpdate,
  onAdd,
  onRemove,
}: {
  label: string;
  values: string[];
  placeholder: string;
  required?: boolean;
  onUpdate: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-black text-[#071f3c]">
          {label}
          {required ? <span className="ml-1 text-cyan-700">*</span> : null}
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-black text-cyan-800 transition hover:bg-cyan-50"
        >
          <Plus className="h-4 w-4" />
          Add row
        </button>
      </div>
      <div className="mt-3 grid gap-2.5">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <span className="flex h-11 w-8 shrink-0 items-center justify-center text-xs font-black text-[#8da0b1]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <input
              value={value}
              onChange={(event) => onUpdate(index, event.target.value)}
              maxLength={500}
              placeholder={placeholder}
              className={`${controlClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${label.toLowerCase()} row ${index + 1}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#7890a6] transition hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobsWorkspace({
  jobs,
  totalJobs,
  filter,
  updatingJobId,
  onFilter,
  onNewJob,
  onEdit,
  onStatus,
}: {
  jobs: HiringJob[];
  totalJobs: number;
  filter: JobFilter;
  updatingJobId: string | null;
  onFilter: (filter: JobFilter) => void;
  onNewJob: () => void;
  onEdit: (job: HiringJob) => void;
  onStatus: (job: HiringJob, status: JobStatus) => void;
}) {
  return (
    <section className="mt-6 pb-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="bd-kicker">Role portfolio</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071f3c] sm:text-4xl">
            Your job listings
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#60778d]">
            {totalJobs
              ? "Review every role from private draft to live recruitment and close."
              : "Create your first structured yacht role when you are ready."}
          </p>
        </div>
        <button type="button" onClick={onNewJob} className="bd-primary-cta">
          <Plus className="h-5 w-5" />
          New job
        </button>
      </div>

      {totalJobs ? (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {(
            [
              ["all", "All roles"],
              ["live", "Live & review"],
              ["draft", "Drafts"],
              ["closed", "Closed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onFilter(value)}
              className={`min-h-11 shrink-0 rounded-xl border px-4 text-xs font-black transition ${
                filter === value
                  ? "border-[#071f3c] bg-[#071f3c] text-white"
                  : "border-[#071f3c]/10 bg-white/75 text-[#60778d] hover:border-cyan-500 hover:text-cyan-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {jobs.length ? (
        <div className="mt-4 grid gap-4">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              updating={updatingJobId === job.id}
              onEdit={onEdit}
              onStatus={onStatus}
            />
          ))}
        </div>
      ) : (
        <div className="bd-glass-card-strong mt-5 rounded-[28px] p-8 text-center sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
            <BriefcaseBusiness className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#071f3c]">
            {totalJobs ? "No roles in this view." : "Your first role starts here."}
          </h3>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-[#60778d]">
            {totalJobs
              ? "Choose another status filter to review the rest of your hiring portfolio."
              : "Build a complete role, save it privately and request publication only when every detail is ready."}
          </p>
          {!totalJobs ? (
            <button
              type="button"
              onClick={onNewJob}
              className="bd-primary-cta mt-6"
            >
              Create first job
              <ArrowRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function JobRow({
  job,
  updating,
  onEdit,
  onStatus,
}: {
  job: HiringJob;
  updating: boolean;
  onEdit: (job: HiringJob) => void;
  onStatus: (job: HiringJob, status: JobStatus) => void;
}) {
  const publicHref =
    job.status === "published" && job.slug
      ? `/jobs/${encodeURIComponent(job.slug)}`
      : "";

  return (
    <article className="bd-glass-card-strong overflow-hidden rounded-[26px]">
      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <JobStatusBadge status={job.status} />
            <span
              data-i18n-ignore
              className="text-xs font-bold text-[#8da0b1]"
            >
              Updated {formatDate(job.updated_at || job.created_at)}
            </span>
          </div>
          <h3
            data-i18n-ignore
            className="mt-4 break-words text-2xl font-black tracking-[-0.035em] text-[#071f3c] [overflow-wrap:anywhere]"
          >
            {job.title}
          </h3>
          <p
            data-i18n-ignore
            className="mt-1 break-words text-sm font-bold text-cyan-800 [overflow-wrap:anywhere]"
          >
            {[job.position, job.department].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#60778d]">
            <span className="inline-flex min-w-0 max-w-full items-start gap-2">
              <Ship className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <span
                data-i18n-ignore
                className="min-w-0 break-words [overflow-wrap:anywhere]"
              >
                {job.yacht_name || "Yacht not disclosed"}
              </span>
            </span>
            <span className="inline-flex min-w-0 max-w-full items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <span
                data-i18n-ignore
                className="min-w-0 break-words [overflow-wrap:anywhere]"
              >
                {job.location || "Flexible"}
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-cyan-700" />
              <span>{humanize(job.employment_type)}</span>
            </span>
          </div>
        </div>
        <div className="grid min-w-44 grid-cols-2 gap-3 lg:grid-cols-1">
          <Link
            href={`/hiring/jobs/${encodeURIComponent(job.id)}`}
            className="group rounded-2xl bg-[#f3f7fb] px-4 py-3 transition hover:bg-cyan-50"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8da0b1]">
              Applications
            </p>
            <span className="mt-1 flex items-end justify-between gap-3">
              <span
                data-i18n-ignore
                className="text-2xl font-black text-[#071f3c]"
              >
                {job.application_count}
              </span>
              <span className="pb-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-800">
                Open pipeline
              </span>
            </span>
          </Link>
          {publicHref ? (
            <Link
              href={publicHref}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#071f3c]/10 bg-white px-4 text-xs font-black text-[#071f3c] transition hover:border-cyan-400 hover:text-cyan-800"
            >
              View live role
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : (
            <div className="flex min-h-14 items-center justify-center rounded-2xl border border-dashed border-[#071f3c]/12 px-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#8da0b1]">
              Private workflow
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#071f3c]/8 bg-[#f7f9fc]/82 px-5 py-3 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-[#7890a6]">
          <span data-i18n-ignore>{formatSalary(job)}</span>
          {job.application_deadline ? (
            <span data-i18n-ignore>
              Apply by {formatDate(job.application_deadline)}
            </span>
          ) : null}
          {job.published_at ? (
            <span data-i18n-ignore>
              Published {formatDate(job.published_at)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {["draft", "paused"].includes(job.status) ? (
            <button
              type="button"
              onClick={() => onEdit(job)}
              disabled={updating}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#071f3c]/12 bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#526b83] transition hover:border-cyan-400 hover:text-cyan-800 disabled:opacity-50"
            >
              Edit details
            </button>
          ) : null}
          {jobLifecycleActions(job.status).map((action) => (
            <button
              key={action.status}
              type="button"
              onClick={() => onStatus(job, action.status)}
              disabled={updating}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.1em] transition disabled:cursor-wait disabled:opacity-50 ${action.className}`}
            >
              {updating ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const style: Record<JobStatus, string> = {
    draft: "bg-slate-100 text-slate-700",
    pending_review: "bg-amber-50 text-amber-800",
    published: "bg-emerald-50 text-emerald-800",
    paused: "bg-cyan-50 text-cyan-800",
    filled: "bg-violet-50 text-violet-800",
    closed: "bg-slate-100 text-slate-600",
    rejected: "bg-rose-50 text-rose-800",
    expired: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${style[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {jobStatusLabels[status]}
    </span>
  );
}

function jobLifecycleActions(status: JobStatus): Array<{
  status: JobStatus;
  label: string;
  className: string;
}> {
  const primary =
    "bg-[#071f3c] text-white hover:bg-cyan-800";
  const neutral =
    "border border-[#071f3c]/12 bg-white text-[#526b83] hover:border-cyan-400 hover:text-cyan-800";
  const danger =
    "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100";

  if (status === "draft" || status === "pending_review") {
    return [
      { status: "published", label: "Publish", className: primary },
      { status: "closed", label: "Close", className: danger },
    ];
  }
  if (status === "published") {
    return [
      { status: "paused", label: "Pause", className: neutral },
      { status: "filled", label: "Mark filled", className: primary },
      { status: "closed", label: "Close", className: danger },
    ];
  }
  if (status === "paused") {
    return [
      { status: "published", label: "Resume", className: primary },
      { status: "closed", label: "Close", className: danger },
    ];
  }
  if (status === "filled") {
    return [{ status: "closed", label: "Close", className: danger }];
  }
  if (status === "rejected" || status === "expired") {
    return [
      { status: "draft", label: "Return to draft", className: neutral },
    ];
  }
  return [];
}

function lifecycleSuccessMessage(status: JobStatus) {
  const messages: Partial<Record<JobStatus, string>> = {
    draft: "Role returned to a private draft.",
    published: "Role is live on the BlueDeck job board.",
    paused: "Role paused and removed from the public board.",
    filled: "Role marked as filled. Candidate records remain in the pipeline.",
    closed: "Role closed and removed from the public board.",
  };
  return messages[status] || "Role status updated.";
}

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex min-h-6 items-end justify-between gap-3">
        <span className="text-sm font-black text-[#071f3c]">
          {label}
          {required ? <span className="ml-1 text-cyan-700">*</span> : null}
        </span>
        {hint ? (
          <span className="text-right text-[10px] font-bold text-[#8da0b1]">
            {hint}
          </span>
        ) : null}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const controlClass =
  "min-h-12 min-w-0 w-full rounded-xl border border-[#7d8da2] bg-white px-3.5 py-2.5 text-[16px] font-semibold text-[#071f3c] outline-none transition placeholder:text-[#7890a6] hover:border-[#517395] focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/12";

function validateJob(draft: JobDraft, intent: JobIntent) {
  if (draft.title.trim().length < 3) {
    return "Add a clear job title of at least three characters.";
  }
  if (!draft.position || !draft.department) {
    return "Choose the onboard position so BlueDeck can set its department.";
  }
  if (!draft.employment_type) return "Choose an employment type.";
  if (!draft.location.trim()) return "Add the role location.";
  if (!draft.yacht_type) return "Choose the yacht type.";
  if (!draft.summary.trim()) return "Add a concise role summary.";
  if (!draft.description.trim()) return "Add the full role description.";
  if (draft.country_code && draft.country_code.trim().length !== 2) {
    return "Country code must contain two letters.";
  }

  const length = numberOrNull(draft.yacht_length_metres);
  if (length !== null && (length < 1 || length > 300)) {
    return "Yacht length must be between 1 and 300 metres.";
  }
  if (
    draft.start_date &&
    draft.end_date &&
    draft.end_date < draft.start_date
  ) {
    return "End date cannot be earlier than the start date.";
  }
  if (
    draft.application_deadline &&
    draft.application_deadline < new Date().toISOString().slice(0, 10)
  ) {
    return "Application deadline cannot be in the past.";
  }

  const experience = numberOrNull(draft.minimum_experience_years);
  if (experience !== null && (experience < 0 || experience > 80)) {
    return "Minimum experience must be between 0 and 80 years.";
  }

  const minimum = numberOrNull(draft.salary_minimum);
  const maximum = numberOrNull(draft.salary_maximum);
  if (minimum !== null && minimum < 0) {
    return "Minimum salary cannot be negative.";
  }
  if (maximum !== null && maximum < 0) {
    return "Maximum salary cannot be negative.";
  }
  if (minimum !== null && maximum !== null && maximum < minimum) {
    return "Maximum salary cannot be lower than minimum salary.";
  }

  const openings = Number.parseInt(draft.openings_count, 10);
  if (!Number.isFinite(openings) || openings < 1 || openings > 100) {
    return "Open positions must be between 1 and 100.";
  }

  if (intent === "publish") {
    if (!draft.yacht_id) {
      return "Choose an owned BlueDeck yacht before requesting publication.";
    }
    if (draft.summary.trim().length < 20) {
      return "Add a concise summary of at least 20 characters before publishing.";
    }
    if (draft.description.trim().length < 60) {
      return "Add a complete role description of at least 60 characters before publishing.";
    }
    if (!cleanList(draft.responsibilities).length) {
      return "Add at least one responsibility before publishing.";
    }
    if (!cleanList(draft.requirements).length) {
      return "Add at least one requirement before publishing.";
    }
  }

  return "";
}

function employerToDraft(employer: EmployerProfile): EmployerDraft {
  return {
    display_name: employer.display_name,
    company_name: employer.company_name || "",
    employer_type: employer.employer_type,
    country_code: employer.country_code || "",
    description: employer.description,
  };
}

function employerDraftChanged(
  draft: EmployerDraft,
  employer: EmployerProfile,
) {
  const current = employerToDraft(employer);
  return (Object.keys(current) as Array<keyof EmployerDraft>).some(
    (key) =>
      normalizeEmployerDraftText(draft[key]) !==
      normalizeEmployerDraftText(current[key]),
  );
}

function normalizeEmployerDraftText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function employerMaterialIdentityChanged(
  draft: EmployerDraft,
  employer: EmployerProfile,
) {
  const current = employerToDraft(employer);
  return (Object.keys(current) as Array<keyof EmployerDraft>).some(
    (key) =>
      normalizeEmployerMaterialText(draft[key]) !==
      normalizeEmployerMaterialText(current[key]),
  );
}

function normalizeEmployerMaterialText(value: string) {
  return normalizeEmployerDraftText(value).toLocaleLowerCase("en-US");
}

function employerEditorIntroduction(status: VerificationStatus) {
  const introductions: Record<VerificationStatus, string> = {
    unverified:
      "Keep the public employer identity accurate, then request verification after connecting an owned yacht.",
    pending:
      "Correct or refine the employer details while BlueDeck completes the active verification review.",
    verified:
      "Keep candidate-facing identity accurate. Material public changes require a fresh BlueDeck verification review.",
    rejected:
      "Update the employer details requested during review, then resubmit the identity when an owned yacht is connected.",
    suspended:
      "You can maintain accurate employer details, but editing does not remove the current verification suspension.",
  };
  return introductions[status];
}

function employerEditorGuidance(
  status: VerificationStatus,
  yachtConnected: boolean,
  materialChanges: boolean,
) {
  if (status === "verified") {
    return materialChanges
      ? "Material edits will move this verified profile back to pending review."
      : "Your verified status remains active while the saved public identity stays unchanged.";
  }
  if (status === "pending") {
    return "Saving corrections keeps this employer profile in the protected review queue.";
  }
  if (status === "suspended") {
    return "Saving accurate details does not remove the suspension; BlueDeck must review the account.";
  }
  if (yachtConnected) {
    return status === "rejected"
      ? "An owned yacht is connected. Saving will resubmit this employer profile for review."
      : "An owned yacht is connected. Saving will request BlueDeck employer verification.";
  }
  return "Save the employer details now, then connect an owned yacht before requesting verification.";
}

function employerSubmitLabel({
  editing,
  verificationStatus,
  yachtConnected,
}: {
  editing: boolean;
  verificationStatus: VerificationStatus;
  yachtConnected: boolean;
}) {
  if (!editing) return "Create hiring profile";
  if (yachtConnected && verificationStatus === "rejected") {
    return "Resubmit for review";
  }
  if (yachtConnected && verificationStatus === "unverified") {
    return "Request review";
  }
  if (verificationStatus === "verified") return "Save employer changes";
  if (verificationStatus === "pending") return "Save review details";
  return "Save employer details";
}

function employerSaveSuccessMessage(
  previousStatus: VerificationStatus | null,
  nextStatus: VerificationStatus | null,
) {
  if (!previousStatus) {
    return nextStatus === "pending"
      ? "Employer profile created and submitted for BlueDeck verification."
      : "Employer profile created. You can now prepare professional job drafts.";
  }
  if (nextStatus === "pending") {
    if (previousStatus === "verified") {
      return "Employer profile updated and returned to verification review.";
    }
    if (previousStatus === "pending") {
      return "Employer profile updated. Your verification request remains in review.";
    }
    return "Employer profile submitted for BlueDeck verification.";
  }
  if (nextStatus === "verified") {
    return "Employer profile updated. Your verified status remains active.";
  }
  if (nextStatus === "suspended") {
    return "Employer profile updated. Verification remains suspended pending BlueDeck review.";
  }
  if (nextStatus === "rejected") {
    return "Employer profile updated. Connect an owned yacht before resubmitting for review.";
  }
  return "Employer profile saved successfully.";
}

function verificationLabel(status: VerificationStatus) {
  const labels: Record<VerificationStatus, string> = {
    unverified: "Unverified",
    pending: "Review pending",
    verified: "Verified",
    rejected: "Verification declined",
    suspended: "Verification suspended",
  };
  return labels[status];
}

function verificationGuidance(status: VerificationStatus) {
  const guidance: Record<VerificationStatus, string> = {
    unverified: "Verification is required before a role can be published.",
    pending: "BlueDeck is reviewing the employer information supplied.",
    verified: "Verified and eligible to publish roles.",
    rejected: "Review the supplied employer details before trying again.",
    suspended: "Publishing is unavailable while verification is suspended.",
  };
  return guidance[status];
}

async function activeSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.replace(hiringLoginPath);
  return session;
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function payloadError(payload: Record<string, unknown>, fallback: string) {
  return readString(payload, ["error", "message"]) || fallback;
}

function normalizeEmployer(value: unknown): EmployerProfile | null {
  if (!isRecord(value)) return null;
  const id = readString(value, ["id"]);
  const displayName = readString(value, ["display_name"]);
  if (!id || !displayName) return null;

  const rawStatus = readString(value, ["verification_status"]);
  const verificationStatus: VerificationStatus = [
    "unverified",
    "pending",
    "verified",
    "rejected",
    "suspended",
  ].includes(rawStatus)
    ? (rawStatus as VerificationStatus)
    : "unverified";

  return {
    id,
    display_name: displayName,
    company_name: readString(value, ["company_name"]) || null,
    employer_type: readString(value, ["employer_type"]) || "yacht",
    country_code: readString(value, ["country_code"]) || null,
    description: readString(value, ["description"]),
    verification_status: verificationStatus,
    verified_at: readString(value, ["verified_at"]) || null,
  };
}

function normalizeYachts(value: unknown): HiringYacht[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = readString(item, ["id"]);
      const name = readString(item, ["name"]);
      if (!id || !name) return null;
      return {
        id,
        name,
        model: readString(item, ["model"]) || null,
        flag: readString(item, ["flag"]) || null,
      };
    })
    .filter((item): item is HiringYacht => item !== null);
}

function normalizeJobs(value: unknown): HiringJob[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeJob)
    .filter((job): job is HiringJob => job !== null)
    .sort((first, second) => {
      const firstTime = Date.parse(first.updated_at || first.created_at || "");
      const secondTime = Date.parse(second.updated_at || second.created_at || "");
      return (Number.isNaN(secondTime) ? 0 : secondTime) -
        (Number.isNaN(firstTime) ? 0 : firstTime);
    });
}

function normalizeJob(value: unknown): HiringJob | null {
  if (!isRecord(value)) return null;
  const id = readString(value, ["id"]);
  const title = readString(value, ["title"]);
  if (!id || !title) return null;

  const rawStatus = readString(value, ["status"]);
  const status: JobStatus = [
    "draft",
    "pending_review",
    "published",
    "paused",
    "filled",
    "closed",
    "rejected",
    "expired",
  ].includes(rawStatus)
    ? (rawStatus as JobStatus)
    : "draft";

  return {
    id,
    slug: readString(value, ["slug"]) || null,
    title,
    position: readString(value, ["position"]),
    department: readString(value, ["department"]),
    employment_type:
      readString(value, ["employment_type"]) || "permanent",
    yacht_id: readString(value, ["yacht_id"]) || null,
    country_code: readString(value, ["country_code"]) || null,
    yacht_name: readString(value, ["yacht_name"]) || null,
    yacht_type: readString(value, ["yacht_type"]) || null,
    yacht_length_metres: readNumber(value, ["yacht_length_metres"]),
    yacht_program: readString(value, ["yacht_program"]) || null,
    location: readString(value, ["location"]),
    rotation: readString(value, ["rotation"]) || null,
    start_date: readString(value, ["start_date"]) || null,
    end_date: readString(value, ["end_date"]) || null,
    summary: readString(value, ["summary"]),
    description: readString(value, ["description"]),
    responsibilities: readStringArray(value, ["responsibilities"]),
    requirements: readStringArray(value, ["requirements"]),
    benefits: readStringArray(value, ["benefits"]),
    certifications: readStringArray(value, ["certifications"]),
    visas: readStringArray(value, ["visas"]),
    languages: readStringArray(value, ["languages"]),
    minimum_experience_years: readNumber(value, [
      "minimum_experience_years",
    ]),
    application_instructions: readString(value, [
      "application_instructions",
    ]),
    status,
    salary_currency:
      readString(value, ["salary_currency"]) || null,
    salary_minimum: readNumber(value, ["salary_minimum"]),
    salary_maximum: readNumber(value, ["salary_maximum"]),
    salary_period: readString(value, ["salary_period"]) || null,
    salary_visible: value.salary_visible === true,
    openings_count:
      readNumber(value, ["openings_count"]) || 1,
    application_count:
      readNumber(value, ["application_count"]) || 0,
    application_deadline:
      readString(value, ["application_deadline"]) || null,
    published_at: readString(value, ["published_at"]) || null,
    created_at: readString(value, ["created_at"]) || null,
    updated_at: readString(value, ["updated_at"]) || null,
  };
}

function jobToDraft(job: HiringJob): JobDraft {
  return {
    title: job.title,
    position: job.position,
    department: job.department,
    employment_type: job.employment_type,
    yacht_id: job.yacht_id || "",
    location: job.location,
    country_code: job.country_code || "",
    yacht_name: job.yacht_name || "",
    yacht_type: job.yacht_type || "motor_yacht",
    yacht_length_metres:
      job.yacht_length_metres === null
        ? ""
        : String(job.yacht_length_metres),
    yacht_program: job.yacht_program || "private",
    rotation: job.rotation || "",
    start_date: dateInputValue(job.start_date),
    end_date: dateInputValue(job.end_date),
    application_deadline: dateInputValue(job.application_deadline),
    salary_currency: job.salary_currency || "EUR",
    salary_minimum:
      job.salary_minimum === null ? "" : String(job.salary_minimum),
    salary_maximum:
      job.salary_maximum === null ? "" : String(job.salary_maximum),
    salary_period: job.salary_period || "month",
    salary_visible: job.salary_visible,
    openings_count: String(job.openings_count || 1),
    summary: job.summary,
    description: job.description,
    requirements: listForEditor(job.requirements),
    responsibilities: listForEditor(job.responsibilities),
    benefits: listForEditor(job.benefits),
    certifications: listForEditor(job.certifications),
    visas: listForEditor(job.visas),
    languages: listForEditor(job.languages),
    minimum_experience_years:
      job.minimum_experience_years === null
        ? ""
        : String(job.minimum_experience_years),
    application_instructions: job.application_instructions,
  };
}

function readString(
  value: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string") return candidate.trim();
  }
  return "";
}

function readStringArray(
  value: Record<string, unknown>,
  keys: string[],
): string[] {
  for (const key of keys) {
    const candidate = value[key];
    if (!Array.isArray(candidate)) continue;
    return candidate
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function readNumber(
  value: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (
      typeof candidate === "string" &&
      candidate.trim() &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanOptional(value: string) {
  return value.trim() || null;
}

function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function listForEditor(values: string[]) {
  return values.length ? values : [""];
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSalary(job: HiringJob) {
  if (
    !job.salary_visible ||
    (!Number.isFinite(job.salary_minimum) &&
      !Number.isFinite(job.salary_maximum))
  ) {
    return "Salary private";
  }
  const values = [job.salary_minimum, job.salary_maximum].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  const amount = values
    .map((value) =>
      `${job.salary_currency || "EUR"} ${Math.round(value).toLocaleString("en-GB")}`,
    )
    .join(" – ");
  return job.salary_period && job.salary_period !== "contract"
    ? `${amount} / ${job.salary_period}`
    : amount;
}

function previewSalary(draft: JobDraft) {
  const minimum = numberOrNull(draft.salary_minimum);
  const maximum = numberOrNull(draft.salary_maximum);
  if (minimum === null && maximum === null) return "Salary not added";
  if (!draft.salary_visible) return "Salary omitted from listing";
  const values = [minimum, maximum].filter(
    (value): value is number => value !== null,
  );
  const amount = values
    .map(
      (value) =>
        `${draft.salary_currency} ${Math.round(value).toLocaleString("en-GB")}`,
    )
    .join(" – ");
  return draft.salary_period === "contract"
    ? amount
    : `${amount} / ${draft.salary_period}`;
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
