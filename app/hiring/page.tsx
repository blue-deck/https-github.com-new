"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Ship,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  employerAccessNoteLimit,
  type EmployerAccessEntry,
  type EmployerAccessStatus,
  type EmployerAccessYacht,
  type EmployerRole,
} from "../lib/employerAccess";
import {
  marketplaceCapabilitiesForRole,
  marketplaceRoleLabel,
  normalizeMarketplaceAccountRole,
  type MarketplaceCapabilities,
} from "../lib/marketplaceCapabilities";
import type { VerifiedEmployerYacht } from "../lib/jobPosts";
import { supabase } from "../lib/supabase";

type EmployerAccessResponse = {
  ok?: boolean;
  error?: string;
  accountRole?: string;
  isAdmin?: boolean;
  yachts?: EmployerAccessYacht[];
};

type RequestResponse = {
  ok?: boolean;
  error?: string;
  access?: EmployerAccessEntry;
};

type JobWorkspaceResponse = {
  ok?: boolean;
  error?: string;
  capabilities?: MarketplaceCapabilities & {
    postingStatus?: "enabled" | "suspended" | "unavailable";
    planCode?: string;
  };
  yachts?: VerifiedEmployerYacht[];
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

const copy = {
  en: {
    eyebrow: "BlueDeck marketplace",
    title: "Hiring & job access",
    intro:
      "Job posting is self-service for Captain, Owner / Employer and Management accounts. Candidate outreach remains a separate verified yacht tool.",
    privacy: "Private account area",
    adminReview: "Open admin review",
    stepOne: "Connect yacht",
    stepOneText: "Choose a yacht for private candidate outreach.",
    stepTwo: "Verify outreach",
    stepTwoText: "BlueDeck reviews access to private crew contact tools.",
    stepThree: "Contact crew",
    stepThreeText: "Verified yachts can securely invite suitable candidates.",
    yachts: "Outreach verification",
    yachtsIntro:
      "This review applies only to private candidate contact and yacht invitation tools—not to job posting.",
    yacht: "Yacht",
    pending: "Pending",
    verified: "Verified",
    rejected: "Rejected",
    suspended: "Suspended",
    notRequested: "Not requested",
    requestAccess: "Request access",
    requestAgain: "Request another review",
    closeForm: "Cancel",
    relationship: "Your relationship to this yacht",
    owner: "Owner / Employer",
    captain: "Captain",
    management: "Yacht management",
    note: "Note for the BlueDeck review team",
    noteOptional: "Optional",
    notePlaceholder:
      "Add a short detail that can help us confirm your authority.",
    characters: "characters",
    submit: "Send for review",
    submitting: "Sending request…",
    requested: "Requested",
    reviewed: "Reviewed",
    reviewNote: "BlueDeck review note",
    applicantNote: "Your note",
    pendingTitle: "Your request is being reviewed",
    pendingText:
      "No further action is required. This page will show the decision when the review is complete.",
    verifiedTitle: "Private outreach access is active",
    verifiedText:
      "This yacht can use verified candidate contact and crew invitation tools.",
    manageJobs: "Find crew",
    rejectedTitle: "The request needs another review",
    rejectedText:
      "Check the review note, update your details and submit the yacht again.",
    suspendedTitle: "Private outreach is paused",
    suspendedText:
      "Private candidate outreach is unavailable for this yacht until BlueDeck restores access.",
    noYachtsTitle: "No owned yacht for outreach",
    noYachtsText:
      "Private outreach verification must be connected to a yacht registered to your account.",
    addYacht: "Add yacht",
    loading: "Loading hiring access…",
    loadError: "Hiring access could not be loaded.",
    retry: "Try again",
    requestSuccess: "Your private outreach request was sent to BlueDeck.",
    accountRole: "Account type",
    accessSummary: "Access summary",
    totalYachts: "Yachts",
    activeAccess: "Active",
    waitingReview: "In review",
    noDate: "Date unavailable",
    directEyebrow: "Self-service job posting",
    directTitle: "No administrator approval",
    directActive:
      "Your account type can create, publish and manage job posts directly for yachts where you hold current marketplace authority.",
    directCrew:
      "Crew accounts can browse and apply to jobs. Choose Captain, Owner / Employer or Management when creating an account to post jobs.",
    directSuspended:
      "Job posting is currently paused for this account. Existing posts remain protected until access is restored.",
    connectedForPosting: "Yachts available for posting",
    manageDirect: "Manage job posts",
    browseJobs: "Browse jobs",
    connectYacht:
      "Connect a real yacht first: owners register their yacht; captains and management use an active, role-appropriate yacht membership.",
    captainDual:
      "Captain accounts can also browse and apply to jobs with the same account.",
    separateTools: "Separate verified tool",
  },
  tr: {
    eyebrow: "BlueDeck marketplace",
    title: "İşe alım ve ilan yetkisi",
    intro:
      "Captain, Owner / Employer ve Management hesapları iş ilanını doğrudan yayınlar. Adaylarla özel iletişim ise ayrı bir doğrulanmış yat aracıdır.",
    privacy: "Özel hesap alanı",
    adminReview: "Yönetici incelemesini aç",
    stepOne: "Yatı bağla",
    stepOneText: "Özel aday iletişimi için kayıtlı yatını seç.",
    stepTwo: "İletişimi doğrula",
    stepTwoText: "BlueDeck özel crew iletişim araçlarına erişimi inceler.",
    stepThree: "Crew ile iletişim",
    stepThreeText: "Doğrulanan yat uygun adaylara güvenle davet gönderebilir.",
    yachts: "Aday iletişimi doğrulaması",
    yachtsIntro:
      "Bu inceleme yalnız özel aday iletişimi ve yat daveti araçları içindir; iş ilanı yayınlamayı etkilemez.",
    yacht: "Yat",
    pending: "İnceleniyor",
    verified: "Onaylandı",
    rejected: "Reddedildi",
    suspended: "Askıya alındı",
    notRequested: "Talep edilmedi",
    requestAccess: "Yetki talep et",
    requestAgain: "Yeniden inceleme iste",
    closeForm: "Vazgeç",
    relationship: "Bu yatla ilişkin",
    owner: "Owner / Employer",
    captain: "Kaptan",
    management: "Yat yönetimi",
    note: "BlueDeck inceleme ekibine not",
    noteOptional: "İsteğe bağlı",
    notePlaceholder:
      "Yetkini doğrulamamıza yardımcı olacak kısa bir bilgi ekleyebilirsin.",
    characters: "karakter",
    submit: "İncelemeye gönder",
    submitting: "Talep gönderiliyor…",
    requested: "Talep tarihi",
    reviewed: "İnceleme tarihi",
    reviewNote: "BlueDeck inceleme notu",
    applicantNote: "Notun",
    pendingTitle: "Talebin inceleniyor",
    pendingText:
      "Şu an başka bir işlem yapman gerekmiyor. İnceleme tamamlandığında karar bu sayfada görünecek.",
    verifiedTitle: "Özel aday iletişimi aktif",
    verifiedText:
      "Bu yat doğrulanmış aday iletişimi ve crew daveti araçlarını kullanabilir.",
    manageJobs: "Crew bul",
    rejectedTitle: "Talebin yeniden incelenmesi gerekiyor",
    rejectedText:
      "İnceleme notunu kontrol et, bilgilerini güncelle ve yatı yeniden gönder.",
    suspendedTitle: "Özel aday iletişimi duraklatıldı",
    suspendedText:
      "BlueDeck yetkiyi yeniden açana kadar bu yat için özel aday iletişimi kullanılamaz.",
    noYachtsTitle: "Aday iletişimi için kayıtlı yat yok",
    noYachtsText:
      "Özel aday iletişimi doğrulaması hesabına kayıtlı bir yata bağlanmalıdır.",
    addYacht: "Yat ekle",
    loading: "İşe alım yetkisi yükleniyor…",
    loadError: "İşe alım yetkisi yüklenemedi.",
    retry: "Tekrar dene",
    requestSuccess: "Özel aday iletişimi talebin BlueDeck’e gönderildi.",
    accountRole: "Hesap türü",
    accessSummary: "Yetki özeti",
    totalYachts: "Yat",
    activeAccess: "Aktif",
    waitingReview: "İncelemede",
    noDate: "Tarih bilgisi yok",
    directEyebrow: "Doğrudan iş ilanı yayınlama",
    directTitle: "Yönetici onayı gerektirmez",
    directActive:
      "Hesap türün, güncel marketplace yetkin bulunan yatlar için doğrudan iş ilanı oluşturabilir, yayınlayabilir ve yönetebilir.",
    directCrew:
      "Crew hesapları ilanları görüntüleyip başvurabilir. İlan vermek için hesap oluştururken Captain, Owner / Employer veya Management seçilir.",
    directSuspended:
      "Bu hesap için ilan yayınlama şu anda duraklatılmış. Yetki yeniden açılana kadar mevcut ilanlar korunur.",
    connectedForPosting: "İlan verilebilen yat",
    manageDirect: "İş ilanlarını yönet",
    browseJobs: "İş ilanlarına göz at",
    connectYacht:
      "Önce gerçek bir yat bağlantısı kur: yat sahipleri yatını kaydeder; Captain ve Management hesapları role uygun aktif yat üyeliğini kullanır.",
    captainDual:
      "Captain hesabı aynı zamanda iş ilanlarını görüntüleyip başvuru yapabilir.",
    separateTools: "Ayrı doğrulanan araç",
  },
} as const;

const employerRoles: EmployerRole[] = ["owner", "captain", "management"];

export default function HiringPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accountRole, setAccountRole] = useState("crew");
  const [marketplaceCapabilities, setMarketplaceCapabilities] = useState<
    JobWorkspaceResponse["capabilities"]
  >(marketplaceCapabilitiesForRole("crew"));
  const [marketplaceYachtCount, setMarketplaceYachtCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [yachts, setYachts] = useState<EmployerAccessYacht[]>([]);
  const [activeYachtId, setActiveYachtId] = useState("");
  const [role, setRole] = useState<EmployerRole>("owner");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const counts = useMemo(
    () => ({
      total: yachts.length,
      verified: yachts.filter((yacht) => yacht.access?.status === "verified")
        .length,
      pending: yachts.filter((yacht) => yacht.access?.status === "pending")
        .length,
    }),
    [yachts],
  );

  async function loadHiringAccess() {
    setLoading(true);
    setLoadError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/hiring")}`,
      );
      return;
    }

    try {
      const requestOptions = {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store" as const,
      };
      const [accessResponse, workspaceResponse] = await Promise.all([
        fetch("/api/employer-access", requestOptions),
        fetch("/api/employer/job-posts", requestOptions),
      ]);
      const [result, workspace] = await Promise.all([
        accessResponse
          .json()
          .catch(() => null) as Promise<EmployerAccessResponse | null>,
        workspaceResponse
          .json()
          .catch(() => null) as Promise<JobWorkspaceResponse | null>,
      ]);

      if (accessResponse.status === 401 || workspaceResponse.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/hiring")}`,
        );
        return;
      }

      if (!accessResponse.ok || !result?.ok) {
        throw new Error(result?.error || c.loadError);
      }
      if (!workspaceResponse.ok || !workspace?.ok || !workspace.capabilities) {
        throw new Error(workspace?.error || c.loadError);
      }

      const canonicalRole = normalizeMarketplaceAccountRole(
        workspace.capabilities.role,
      );
      setAccountRole(canonicalRole);
      setMarketplaceCapabilities({
        ...marketplaceCapabilitiesForRole(canonicalRole),
        ...workspace.capabilities,
        role: canonicalRole,
        requiresAdminApproval: false,
      });
      setMarketplaceYachtCount(workspace.yachts?.length || 0);
      setIsAdmin(Boolean(result.isAdmin));
      setYachts(result.yachts || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHiringAccess();
  }, []);

  function openRequest(yacht: EmployerAccessYacht) {
    const preferredRole = employerRoles.includes(accountRole as EmployerRole)
      ? (accountRole as EmployerRole)
      : "owner";

    setActiveYachtId(yacht.id);
    setRole(yacht.access?.role || preferredRole);
    setNote(yacht.access?.applicantNote || "");
    setNotice(null);
  }

  function closeRequest() {
    if (submitting) return;
    setActiveYachtId("");
    setNote("");
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeYachtId || submitting) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/hiring")}`,
      );
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/employer-access", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          yachtId: activeYachtId,
          role,
          note: note.trim(),
        }),
      });
      const result = (await response
        .json()
        .catch(() => null)) as RequestResponse | null;

      if (response.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/hiring")}`,
        );
        return;
      }

      if (!response.ok || !result?.ok || !result.access) {
        throw new Error(result?.error || c.loadError);
      }

      setYachts((current) =>
        current.map((yacht) =>
          yacht.id === activeYachtId
            ? { ...yacht, access: result.access || null }
            : yacht,
        ),
      );
      setActiveYachtId("");
      setNote("");
      setNotice({ tone: "success", message: c.requestSuccess });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : c.loadError,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState label={c.loading} />;
  }

  if (loadError) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="bd-ocean-content mx-auto max-w-4xl">
          <div className="bd-glass-card-strong overflow-hidden rounded-[30px]">
            <div className="bd-brand-rule h-1.5" />
            <div className="p-7 sm:p-10">
              <AlertCircle className="h-9 w-9 text-rose-600" aria-hidden />
              <h1 className="mt-5 text-3xl font-semibold text-slate-950">
                {c.loadError}
              </h1>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => void loadHiringAccess()}
                className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {c.retry}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen overflow-x-hidden px-5 pb-24 pt-8 text-slate-900 sm:px-8 sm:pt-10 lg:px-10">
      <div className="bd-ocean-content mx-auto w-full max-w-7xl">
        <section className="bd-page-hero relative overflow-hidden rounded-[34px] border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
          <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="bd-kicker">{c.eyebrow}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                  {c.privacy}
                </span>
              </div>
              <h1 className="bd-serif mt-5 text-5xl leading-none text-[#071f3c] sm:text-6xl">
                {c.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {c.intro}
              </p>
            </div>

            {isAdmin ? (
              <Link
                href="/admin/employer-access"
                className="bd-focus inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#071f3c]/15 bg-white px-5 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50 sm:w-auto"
              >
                <ShieldCheck className="h-4 w-4 text-cyan-700" aria-hidden />
                {c.adminReview}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>

          <div className="mt-9 overflow-hidden rounded-[26px] border border-emerald-200 bg-emerald-50/70 p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {c.directEyebrow}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#071f3c]">
                    {marketplaceRoleLabel(
                      normalizeMarketplaceAccountRole(accountRole),
                      language,
                    )}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">
                  {c.directTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">
                  {marketplaceCapabilities?.postingStatus === "suspended"
                    ? c.directSuspended
                    : marketplaceCapabilities?.canPostJobs
                      ? c.directActive
                      : c.directCrew}
                </p>
                {marketplaceCapabilities?.canPostJobs ? (
                  <p className="mt-3 text-sm font-bold text-emerald-900">
                    {c.connectedForPosting}: {marketplaceYachtCount}
                  </p>
                ) : null}
                {marketplaceCapabilities?.canPostJobs &&
                marketplaceYachtCount === 0 ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {c.connectYacht}
                  </p>
                ) : null}
                {normalizeMarketplaceAccountRole(accountRole) === "captain" ? (
                  <p className="mt-2 text-sm font-semibold text-cyan-900">
                    {c.captainDual}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                {marketplaceCapabilities?.canPostJobs &&
                marketplaceYachtCount > 0 ? (
                  <Link
                    href="/hiring/jobs"
                    className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                  >
                    <BriefcaseBusiness className="h-4 w-4" aria-hidden />
                    {c.manageDirect}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
                {marketplaceCapabilities?.canApplyJobs ? (
                  <Link
                    href="/jobs"
                    className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#071f3c]/15 bg-white px-5 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
                  >
                    {c.browseJobs}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <p className="bd-kicker mt-9">{c.separateTools}</p>
          <div className="mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white/75 md:grid-cols-3">
            <ProcessStep
              number="01"
              title={c.stepOne}
              text={c.stepOneText}
              icon={<Ship className="h-5 w-5" aria-hidden />}
            />
            <ProcessStep
              number="02"
              title={c.stepTwo}
              text={c.stepTwoText}
              icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
            />
            <ProcessStep
              number="03"
              title={c.stepThree}
              text={c.stepThreeText}
              icon={<BriefcaseBusiness className="h-5 w-5" aria-hidden />}
            />
          </div>
        </section>

        <section
          aria-label={c.accessSummary}
          className="mt-5 grid gap-3 sm:grid-cols-3"
        >
          <SummaryCard label={c.totalYachts} value={counts.total} tone="navy" />
          <SummaryCard
            label={c.activeAccess}
            value={counts.verified}
            tone="emerald"
          />
          <SummaryCard
            label={c.waitingReview}
            value={counts.pending}
            tone="amber"
          />
        </section>

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

        <section className="mt-9" aria-labelledby="connected-yachts-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="bd-kicker">{c.yacht}</p>
              <h2
                id="connected-yachts-title"
                className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl"
              >
                {c.yachts}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {c.yachtsIntro}
              </p>
            </div>
            <p className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600">
              {c.accountRole}:{" "}
              <span className="text-[#071f3c]">
                {roleLabel(accountRole, c)}
              </span>
            </p>
          </div>

          {yachts.length === 0 ? (
            <div className="bd-glass-card-strong mt-5 rounded-[30px] p-7 sm:p-10">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
                <Ship className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                {c.noYachtsTitle}
              </h3>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                {c.noYachtsText}
              </p>
              <Link
                href="/yachts"
                className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {c.addYacht}
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              {yachts.map((yacht) => {
                const active = activeYachtId === yacht.id;
                return (
                  <YachtAccessCard
                    key={yacht.id}
                    yacht={yacht}
                    active={active}
                    role={role}
                    note={note}
                    submitting={submitting}
                    language={language}
                    c={c}
                    onOpen={() => openRequest(yacht)}
                    onClose={closeRequest}
                    onRoleChange={setRole}
                    onNoteChange={setNote}
                    onSubmit={submitRequest}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function YachtAccessCard({
  yacht,
  active,
  role,
  note,
  submitting,
  language,
  c,
  onOpen,
  onClose,
  onRoleChange,
  onNoteChange,
  onSubmit,
}: {
  yacht: EmployerAccessYacht;
  active: boolean;
  role: EmployerRole;
  note: string;
  submitting: boolean;
  language: "en" | "tr";
  c: (typeof copy)["en"] | (typeof copy)["tr"];
  onOpen: () => void;
  onClose: () => void;
  onRoleChange: (role: EmployerRole) => void;
  onNoteChange: (note: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const access = yacht.access;
  const status = access?.status;
  const presentation = statusPresentation(status, c);
  const StatusIcon = presentation.icon;
  const canRequest = !status || status === "rejected";

  return (
    <article className="bd-glass-card-strong overflow-hidden rounded-[30px]">
      <div className={`h-1 ${presentation.ruleClass}`} />
      <div className="p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-800 shadow-sm">
              <Ship className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
                {c.yacht}
              </p>
              <h3 className="mt-1 break-words text-2xl font-semibold tracking-[-0.02em] text-slate-950">
                {yacht.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {[yacht.model, yacht.flag].filter(Boolean).join(" · ") || "BlueDeck"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${presentation.badgeClass}`}
          >
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />
            {presentation.label}
          </span>
        </div>

        {access ? (
          <div className={`mt-6 rounded-2xl border p-5 ${presentation.panelClass}`}>
            <div className="flex items-start gap-3">
              <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <h4 className="font-black">{presentation.title}</h4>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  {presentation.text}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 border-t border-current/10 pt-4 text-sm sm:grid-cols-3">
              <Detail
                label={c.relationship}
                value={roleLabel(access.role, c)}
              />
              <Detail
                label={c.requested}
                value={formatDate(access.requestedAt, language, c.noDate)}
              />
              {access.reviewedAt ? (
                <Detail
                  label={c.reviewed}
                  value={formatDate(access.reviewedAt, language, c.noDate)}
                />
              ) : null}
            </dl>

            {access.reviewNote ? (
              <div className="mt-4 border-t border-current/10 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
                  {c.reviewNote}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {access.reviewNote}
                </p>
              </div>
            ) : null}

            {status === "verified" ? (
              <Link
                href="/find-crew"
                className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <BriefcaseBusiness className="h-4 w-4" aria-hidden />
                {c.manageJobs}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : null}

        {!active && canRequest ? (
          <button
            type="button"
            onClick={onOpen}
            className="bd-focus mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800 sm:w-auto"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {status === "rejected" ? c.requestAgain : c.requestAccess}
          </button>
        ) : null}

        {active ? (
          <form
            onSubmit={onSubmit}
            className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/55 p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="bd-kicker">{c.requestAccess}</p>
                <h4 className="mt-2 text-xl font-semibold text-slate-950">
                  {yacht.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="bd-focus min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-cyan-300 hover:text-slate-950 disabled:opacity-50"
              >
                {c.closeForm}
              </button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                  {c.relationship}
                </span>
                <select
                  value={role}
                  onChange={(event) =>
                    onRoleChange(event.target.value as EmployerRole)
                  }
                  disabled={submitting}
                  className="bd-focus mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {employerRoles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel(item, c)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                  <span>{c.note}</span>
                  <span className="font-semibold normal-case tracking-normal text-slate-400">
                    {c.noteOptional}
                  </span>
                </span>
                <textarea
                  value={note}
                  onChange={(event) =>
                    onNoteChange(
                      event.target.value.slice(0, employerAccessNoteLimit),
                    )
                  }
                  maxLength={employerAccessNoteLimit}
                  rows={4}
                  disabled={submitting}
                  placeholder={c.notePlaceholder}
                  className="bd-focus mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 placeholder:text-slate-400 disabled:opacity-60"
                />
                <span className="mt-1 block text-right text-xs font-semibold text-slate-400">
                  {note.length}/{employerAccessNoteLimit} {c.characters}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bd-focus mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {submitting ? c.submitting : c.submit}
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ProcessStep({
  number,
  title,
  text,
  icon,
}: {
  number: string;
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-4 border-b border-slate-200 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071f3c] text-cyan-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-black tracking-[0.14em] text-cyan-700">
          {number}
        </p>
        <h2 className="mt-1 font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "navy" | "emerald" | "amber";
}) {
  const toneClass = {
    navy: "border-slate-200 bg-white text-[#071f3c]",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.13em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-[0.12em] opacity-65">
        {label}
      </dt>
      <dd className="mt-1 break-words font-bold">{value}</dd>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center px-5 py-16 text-slate-900">
      <div className="bd-ocean-content text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100 bg-white text-cyan-800 shadow-lg">
          <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-slate-600">
          {label}
        </p>
      </div>
    </main>
  );
}

function roleLabel(
  role: string,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  if (role === "owner") return c.owner;
  if (role === "captain") return c.captain;
  if (role === "management") return c.management;
  return role || "—";
}

function formatDate(value: string, language: "en" | "tr", fallback: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusPresentation(
  status: EmployerAccessStatus | undefined,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  if (status === "pending") {
    return {
      label: c.pending,
      title: c.pendingTitle,
      text: c.pendingText,
      icon: Clock,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
      panelClass: "border-amber-200 bg-amber-50 text-amber-950",
      ruleClass: "bg-amber-400",
    };
  }

  if (status === "verified") {
    return {
      label: c.verified,
      title: c.verifiedTitle,
      text: c.verifiedText,
      icon: CheckCircle2,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
      panelClass: "border-emerald-200 bg-emerald-50 text-emerald-950",
      ruleClass: "bg-emerald-500",
    };
  }

  if (status === "rejected") {
    return {
      label: c.rejected,
      title: c.rejectedTitle,
      text: c.rejectedText,
      icon: AlertCircle,
      badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
      panelClass: "border-rose-200 bg-rose-50 text-rose-950",
      ruleClass: "bg-rose-500",
    };
  }

  if (status === "suspended") {
    return {
      label: c.suspended,
      title: c.suspendedTitle,
      text: c.suspendedText,
      icon: Ban,
      badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
      panelClass: "border-slate-300 bg-slate-100 text-slate-800",
      ruleClass: "bg-slate-500",
    };
  }

  return {
    label: c.notRequested,
    title: c.requestAccess,
    text: "",
    icon: ShieldCheck,
    badgeClass: "border-slate-200 bg-white text-slate-600",
    panelClass: "border-slate-200 bg-white text-slate-700",
    ruleClass: "bd-brand-rule",
  };
}
