"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Inbox,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ship,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";
import {
  employerAccessNoteLimit,
  type EmployerAccessEntry,
  type EmployerAccessStatus,
  type EmployerRole,
} from "../../lib/employerAccess";
import { supabase } from "../../lib/supabase";

type EmployerRequest = {
  userId: string;
  applicantName: string;
  applicantEmail: string;
  access: EmployerAccessEntry;
};

type AdminListResponse = {
  ok?: boolean;
  error?: string;
  requests?: EmployerRequest[];
};

type AdminReviewResponse = {
  ok?: boolean;
  error?: string;
  access?: EmployerAccessEntry;
};

type RequestFilter = "all" | EmployerAccessStatus;

type Notice = {
  tone: "success" | "error";
  message: string;
};

const copy = {
  en: {
    eyebrow: "Platform administration",
    title: "Employer access review",
    intro:
      "Review the person, yacht and declared relationship before activating BlueDeck hiring authority.",
    private: "Admin only",
    backToHiring: "Hiring access",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    all: "All",
    pending: "Pending",
    verified: "Verified",
    rejected: "Rejected",
    suspended: "Suspended",
    total: "Total requests",
    awaiting: "Awaiting review",
    approved: "Approved",
    paused: "Rejected or suspended",
    queue: "Review queue",
    queueIntro: "Select a request to inspect its full record.",
    search: "Search requests",
    searchPlaceholder: "Applicant, email or yacht",
    noResults: "No requests match this view.",
    clearSearch: "Clear search",
    reviewDetails: "Review details",
    selectRequest: "Select a request",
    selectRequestText:
      "Choose an applicant from the queue to open the review workspace.",
    applicant: "Applicant",
    email: "Email",
    yacht: "Yacht",
    relationship: "Relationship",
    requested: "Requested",
    lastUpdated: "Last updated",
    reviewed: "Last reviewed",
    applicantNote: "Applicant note",
    noApplicantNote: "No note was provided with this request.",
    previousReview: "Previous review note",
    noReviewNote: "No previous review note.",
    decision: "Decision",
    approve: "Approve access",
    reject: "Reject request",
    suspend: "Suspend access",
    restore: "Restore access",
    decisionApprove: "Approve this yacht for hiring?",
    decisionReject: "Reject this employer request?",
    decisionSuspend: "Suspend this yacht’s hiring access?",
    decisionRestore: "Restore hiring access for this yacht?",
    approveHelp:
      "The account will receive verified employer access for this yacht.",
    rejectHelp:
      "The applicant can update the request and submit it again.",
    suspendHelp:
      "Hiring access will be paused until an administrator restores it.",
    restoreHelp: "The account will regain verified hiring access.",
    reviewNote: "Review note",
    noteOptional: "Optional for approval",
    noteRequired: "Required for rejection or suspension",
    notePlaceholder: "Record the reason or any follow-up required.",
    noteError: "Add a short review note before continuing.",
    characters: "characters",
    cancel: "Cancel",
    confirm: "Confirm decision",
    saving: "Saving decision…",
    saved: "The employer access decision was saved.",
    loadError: "Employer requests could not be loaded.",
    retry: "Try again",
    loading: "Loading employer requests…",
    accessDenied: "Administrator access required",
    accessDeniedText:
      "This private workspace is available only to BlueDeck platform administrators.",
    dashboard: "Return to dashboard",
    accountUnavailable: "Date unavailable",
    owner: "Owner",
    captain: "Captain",
    management: "Yacht management",
    requestCount: "requests",
  },
  tr: {
    eyebrow: "Platform yönetimi",
    title: "İşveren yetkisi incelemesi",
    intro:
      "BlueDeck işe alım yetkisini açmadan önce kişiyi, yatı ve beyan edilen ilişkiyi incele.",
    private: "Yalnızca yönetici",
    backToHiring: "İşe alım yetkisi",
    refresh: "Yenile",
    refreshing: "Yenileniyor…",
    all: "Tümü",
    pending: "İnceleniyor",
    verified: "Onaylandı",
    rejected: "Reddedildi",
    suspended: "Askıda",
    total: "Toplam talep",
    awaiting: "İnceleme bekleyen",
    approved: "Onaylanan",
    paused: "Reddedilen veya askıda",
    queue: "İnceleme sırası",
    queueIntro: "Tüm kaydı incelemek için bir talep seç.",
    search: "Taleplerde ara",
    searchPlaceholder: "Başvuran, e-posta veya yat",
    noResults: "Bu görünümde eşleşen talep yok.",
    clearSearch: "Aramayı temizle",
    reviewDetails: "İnceleme detayları",
    selectRequest: "Bir talep seç",
    selectRequestText:
      "İnceleme alanını açmak için sıradan bir başvuran seç.",
    applicant: "Başvuran",
    email: "E-posta",
    yacht: "Yat",
    relationship: "İlişki",
    requested: "Talep tarihi",
    lastUpdated: "Son güncelleme",
    reviewed: "Son inceleme",
    applicantNote: "Başvuran notu",
    noApplicantNote: "Bu taleple birlikte bir not gönderilmedi.",
    previousReview: "Önceki inceleme notu",
    noReviewNote: "Önceki inceleme notu yok.",
    decision: "Karar",
    approve: "Yetkiyi onayla",
    reject: "Talebi reddet",
    suspend: "Yetkiyi askıya al",
    restore: "Yetkiyi geri aç",
    decisionApprove: "Bu yat için işe alım yetkisi onaylansın mı?",
    decisionReject: "Bu işveren talebi reddedilsin mi?",
    decisionSuspend: "Bu yatın işe alım yetkisi askıya alınsın mı?",
    decisionRestore: "Bu yatın işe alım yetkisi geri açılsın mı?",
    approveHelp:
      "Hesap bu yat için doğrulanmış işveren yetkisi alacak.",
    rejectHelp:
      "Başvuran talebi güncelleyip yeniden gönderebilir.",
    suspendHelp:
      "Bir yönetici geri açana kadar işe alım yetkisi duraklatılacak.",
    restoreHelp: "Hesap doğrulanmış işe alım yetkisini yeniden kazanacak.",
    reviewNote: "İnceleme notu",
    noteOptional: "Onay için isteğe bağlı",
    noteRequired: "Ret veya askıya alma için zorunlu",
    notePlaceholder: "Gerekçeyi veya takip edilmesi gereken adımı kaydet.",
    noteError: "Devam etmeden önce kısa bir inceleme notu ekle.",
    characters: "karakter",
    cancel: "Vazgeç",
    confirm: "Kararı onayla",
    saving: "Karar kaydediliyor…",
    saved: "İşveren yetkisi kararı kaydedildi.",
    loadError: "İşveren talepleri yüklenemedi.",
    retry: "Tekrar dene",
    loading: "İşveren talepleri yükleniyor…",
    accessDenied: "Yönetici yetkisi gerekli",
    accessDeniedText:
      "Bu özel alan yalnızca BlueDeck platform yöneticileri tarafından kullanılabilir.",
    dashboard: "Panele dön",
    accountUnavailable: "Tarih bilgisi yok",
    owner: "Yat sahibi",
    captain: "Kaptan",
    management: "Yat yönetimi",
    requestCount: "talep",
  },
} as const;

const filters: RequestFilter[] = [
  "all",
  "pending",
  "verified",
  "rejected",
  "suspended",
];

export default function AdminEmployerAccessPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [requests, setRequests] = useState<EmployerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [filter, setFilter] = useState<RequestFilter>("pending");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [decision, setDecision] = useState<EmployerAccessStatus | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((item) => item.access.status === "pending").length,
      verified: requests.filter((item) => item.access.status === "verified")
        .length,
      rejected: requests.filter((item) => item.access.status === "rejected")
        .length,
      suspended: requests.filter((item) => item.access.status === "suspended")
        .length,
    }),
    [requests],
  );

  const visibleRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(
      language === "tr" ? "tr-TR" : "en-GB",
    );

    return requests.filter((item) => {
      if (filter !== "all" && item.access.status !== filter) return false;
      if (!normalizedQuery) return true;

      return [
        item.applicantName,
        item.applicantEmail,
        item.access.yachtName,
        item.access.yachtModel,
      ].some((value) =>
        value
          .toLocaleLowerCase(language === "tr" ? "tr-TR" : "en-GB")
          .includes(normalizedQuery),
      );
    });
  }, [filter, language, query, requests]);

  const selectedRequest =
    visibleRequests.find((item) => requestKey(item) === selectedKey) ||
    visibleRequests[0] ||
    null;

  async function loadRequests(mode: "initial" | "refresh" = "initial") {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    setLoadError("");
    setAccessDenied(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/admin/employer-access")}`,
      );
      return;
    }

    try {
      const response = await fetch("/api/admin/employer-access", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = (await response
        .json()
        .catch(() => null)) as AdminListResponse | null;

      if (response.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/admin/employer-access")}`,
        );
        return;
      }

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || c.loadError);
      }

      const nextRequests = result.requests || [];
      setRequests(nextRequests);
      setSelectedKey((current) => {
        if (nextRequests.some((item) => requestKey(item) === current)) {
          return current;
        }
        return (
          nextRequests.find((item) => item.access.status === "pending")
            ? requestKey(
                nextRequests.find(
                  (item) => item.access.status === "pending",
                ) as EmployerRequest,
              )
            : nextRequests[0]
              ? requestKey(nextRequests[0])
              : ""
        );
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : c.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    setDecision(null);
    setReviewError("");
    setReviewNote("");
  }, [
    selectedRequest?.access.requestId,
    selectedRequest?.access.updatedAt,
  ]);

  function chooseRequest(item: EmployerRequest) {
    setSelectedKey(requestKey(item));
    setNotice(null);
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        reviewHeadingRef.current?.focus();
        reviewHeadingRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  function beginDecision(status: EmployerAccessStatus) {
    setDecision(status);
    setReviewError("");
    setNotice(null);
    setReviewNote("");
  }

  async function saveDecision() {
    if (!selectedRequest || !decision || saving) return;

    if (
      (decision === "rejected" || decision === "suspended") &&
      !reviewNote.trim()
    ) {
      setReviewError(c.noteError);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/admin/employer-access")}`,
      );
      return;
    }

    setSaving(true);
    setReviewError("");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/employer-access", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedRequest.userId,
          requestId: selectedRequest.access.requestId,
          status: decision,
          note: reviewNote.trim(),
        }),
      });
      const result = (await response
        .json()
        .catch(() => null)) as AdminReviewResponse | null;

      if (response.status === 401) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/admin/employer-access")}`,
        );
        return;
      }

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (!response.ok || !result?.ok || !result.access) {
        throw new Error(result?.error || c.loadError);
      }

      const updatedAccess = result.access;
      setRequests((current) =>
        current.map((item) =>
          item.userId === selectedRequest.userId &&
          item.access.requestId === selectedRequest.access.requestId
            ? { ...item, access: updatedAccess }
            : item,
        ),
      );
      setDecision(null);
      setNotice({ tone: "success", message: c.saved });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : c.loadError,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label={c.loading} />;
  }

  if (accessDenied) {
    return <AccessDenied c={c} />;
  }

  if (loadError) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="bd-ocean-content mx-auto max-w-4xl">
          <div className="bd-glass-card-strong overflow-hidden rounded-[30px]">
            <div className="h-1.5 bg-rose-500" />
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
                onClick={() => void loadRequests()}
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
      <div className="bd-ocean-content mx-auto w-full max-w-[1500px]">
        <section className="bd-page-hero relative overflow-hidden rounded-[34px] border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
          <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="bd-kicker">{c.eyebrow}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                  {c.private}
                </span>
              </div>
              <h1 className="bd-serif mt-5 text-5xl leading-none text-[#071f3c] sm:text-6xl">
                {c.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {c.intro}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/hiring"
                className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {c.backToHiring}
              </Link>
              <button
                type="button"
                onClick={() => void loadRequests("refresh")}
                disabled={refreshing}
                className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
                {refreshing ? c.refreshing : c.refresh}
              </button>
            </div>
          </div>
        </section>

        <section
          aria-label={c.total}
          className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryCard label={c.total} value={counts.all} tone="navy" />
          <SummaryCard label={c.awaiting} value={counts.pending} tone="amber" />
          <SummaryCard
            label={c.approved}
            value={counts.verified}
            tone="emerald"
          />
          <SummaryCard
            label={c.paused}
            value={counts.rejected + counts.suspended}
            tone="rose"
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

        <section className="mt-8" aria-labelledby="review-queue-title">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="bd-kicker">{c.decision}</p>
              <h2
                id="review-queue-title"
                className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl"
              >
                {c.queue}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {c.queueIntro}
              </p>
            </div>

            <div
              role="group"
              aria-label={c.queue}
              className="flex max-w-full gap-2 overflow-x-auto pb-1"
            >
              {filters.map((item) => {
                const active = filter === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setFilter(item);
                      setDecision(null);
                      setNotice(null);
                    }}
                    className={`bd-focus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-black transition ${
                      active
                        ? "border-[#071f3c] bg-[#071f3c] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-[#071f3c]"
                    }`}
                  >
                    {filterLabel(item, c)}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        active ? "bg-white/15 text-white" : "bg-slate-100"
                      }`}
                    >
                      {counts[item]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
            <div className="bd-glass-card overflow-hidden rounded-[28px]">
              <div className="border-b border-slate-200 bg-white/75 p-4 sm:p-5">
                <label className="block">
                  <span className="sr-only">{c.search}</span>
                  <span className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={c.searchPlaceholder}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label={c.clearSearch}
                        className="bd-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </span>
                </label>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  {visibleRequests.length} {c.requestCount}
                </p>
              </div>

              <div className="max-h-[720px] overflow-y-auto p-3 sm:p-4">
                {visibleRequests.length ? (
                  <div className="grid gap-2">
                    {visibleRequests.map((item) => (
                      <RequestRow
                        key={requestKey(item)}
                        item={item}
                        selected={
                          selectedRequest
                            ? requestKey(selectedRequest) === requestKey(item)
                            : false
                        }
                        language={language}
                        c={c}
                        onSelect={() => chooseRequest(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
                    <Inbox className="h-9 w-9 text-slate-300" aria-hidden />
                    <p className="mt-4 font-black text-slate-700">{c.noResults}</p>
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="bd-focus mt-4 min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:border-cyan-300 hover:text-slate-950"
                      >
                        {c.clearSearch}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 lg:sticky lg:top-[112px]">
              {selectedRequest ? (
                <ReviewPanel
                  item={selectedRequest}
                  decision={decision}
                  reviewNote={reviewNote}
                  reviewError={reviewError}
                  saving={saving}
                  language={language}
                  c={c}
                  headingRef={reviewHeadingRef}
                  onDecision={beginDecision}
                  onNoteChange={(value) => {
                    setReviewNote(value.slice(0, employerAccessNoteLimit));
                    setReviewError("");
                  }}
                  onCancel={() => {
                    setDecision(null);
                    setReviewError("");
                    setReviewNote("");
                  }}
                  onConfirm={() => void saveDecision()}
                />
              ) : (
                <div className="bd-glass-card-strong rounded-[28px] p-8 text-center sm:p-12">
                  <ShieldCheck
                    className="mx-auto h-10 w-10 text-slate-300"
                    aria-hidden
                  />
                  <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                    {c.selectRequest}
                  </h3>
                  <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
                    {c.selectRequestText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RequestRow({
  item,
  selected,
  language,
  c,
  onSelect,
}: {
  item: EmployerRequest;
  selected: boolean;
  language: "en" | "tr";
  c: (typeof copy)["en"] | (typeof copy)["tr"];
  onSelect: () => void;
}) {
  const status = statusPresentation(item.access.status, c);
  const StatusIcon = status.icon;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-controls="employer-review-panel"
      onClick={onSelect}
      className={`bd-focus w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-cyan-300 bg-cyan-50/80 shadow-sm"
          : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950">
            {item.applicantName}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            {item.applicantEmail}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${status.badgeClass}`}
        >
          <StatusIcon className="h-3 w-3" aria-hidden />
          {status.label}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-200/80 pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#173f4a]">
            {item.access.yachtName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {roleLabel(item.access.role, c)}
          </p>
        </div>
        <time
          dateTime={item.access.updatedAt || item.access.requestedAt}
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"
        >
          {formatDate(
            item.access.updatedAt || item.access.requestedAt,
            language,
            c.accountUnavailable,
          )}
        </time>
      </div>
    </button>
  );
}

function ReviewPanel({
  item,
  decision,
  reviewNote,
  reviewError,
  saving,
  language,
  c,
  headingRef,
  onDecision,
  onNoteChange,
  onCancel,
  onConfirm,
}: {
  item: EmployerRequest;
  decision: EmployerAccessStatus | null;
  reviewNote: string;
  reviewError: string;
  saving: boolean;
  language: "en" | "tr";
  c: (typeof copy)["en"] | (typeof copy)["tr"];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onDecision: (status: EmployerAccessStatus) => void;
  onNoteChange: (note: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const status = statusPresentation(item.access.status, c);
  const StatusIcon = status.icon;

  return (
    <article
      id="employer-review-panel"
      className="bd-glass-card-strong overflow-hidden rounded-[28px]"
    >
      <div className={`h-1.5 ${status.ruleClass}`} />
      <div className="p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="bd-kicker">{c.reviewDetails}</p>
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 break-words text-3xl font-semibold tracking-[-0.025em] text-slate-950 focus:outline-none"
            >
              {item.applicantName}
            </h3>
            <p className="mt-2 flex items-center gap-2 break-all text-sm font-semibold text-slate-500">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              {item.applicantEmail || "—"}
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${status.badgeClass}`}
          >
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />
            {status.label}
          </span>
        </div>

        <dl className="mt-6 grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2">
          <ReviewDetail
            icon={<UserRound className="h-4 w-4" aria-hidden />}
            label={c.applicant}
            value={item.applicantName}
          />
          <ReviewDetail
            icon={<Ship className="h-4 w-4" aria-hidden />}
            label={c.yacht}
            value={[
              item.access.yachtName,
              item.access.yachtModel,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <ReviewDetail
            icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
            label={c.relationship}
            value={roleLabel(item.access.role, c)}
          />
          <ReviewDetail
            icon={<Clock className="h-4 w-4" aria-hidden />}
            label={c.requested}
            value={formatDateTime(
              item.access.requestedAt,
              language,
              c.accountUnavailable,
            )}
          />
        </dl>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NoteBlock
            title={c.applicantNote}
            text={item.access.applicantNote || c.noApplicantNote}
            muted={!item.access.applicantNote}
          />
          <NoteBlock
            title={c.previousReview}
            text={item.access.reviewNote || c.noReviewNote}
            muted={!item.access.reviewNote}
          />
        </div>

        <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-3 border-y border-slate-200 py-4 text-xs">
          <InlineDate
            label={c.lastUpdated}
            value={item.access.updatedAt}
            language={language}
            fallback={c.accountUnavailable}
          />
          {item.access.reviewedAt ? (
            <InlineDate
              label={c.reviewed}
              value={item.access.reviewedAt}
              language={language}
              fallback={c.accountUnavailable}
            />
          ) : null}
        </dl>

        <section className="mt-6" aria-labelledby="decision-title">
          <p className="bd-kicker">{c.decision}</p>
          <h4
            id="decision-title"
            className="mt-2 text-xl font-semibold text-slate-950"
          >
            {decision
              ? decisionTitle(decision, item.access.status, c)
              : status.label}
          </h4>

          {!decision ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {decisionOptions(item.access.status).map((option) => {
                const destructive =
                  option === "rejected" || option === "suspended";
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onDecision(option)}
                    className={`bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-black transition ${
                      destructive
                        ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                        : "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                    }`}
                  >
                    {option === "verified" ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    ) : option === "suspended" ? (
                      <Ban className="h-4 w-4" aria-hidden />
                    ) : (
                      <X className="h-4 w-4" aria-hidden />
                    )}
                    {decisionButtonLabel(option, item.access.status, c)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              role="alertdialog"
              aria-labelledby="decision-confirmation-title"
              aria-describedby="decision-confirmation-help"
              className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5"
            >
              <h5
                id="decision-confirmation-title"
                className="font-black text-slate-950"
              >
                {decisionTitle(decision, item.access.status, c)}
              </h5>
              <p
                id="decision-confirmation-help"
                className="mt-2 text-sm leading-6 text-slate-600"
              >
                {decisionHelp(decision, item.access.status, c)}
              </p>

              <label className="mt-5 block">
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                  <span>{c.reviewNote}</span>
                  <span
                    className={`font-semibold normal-case tracking-normal ${
                      decision === "rejected" || decision === "suspended"
                        ? "text-rose-600"
                        : "text-slate-400"
                    }`}
                  >
                    {decision === "rejected" || decision === "suspended"
                      ? c.noteRequired
                      : c.noteOptional}
                  </span>
                </span>
                <textarea
                  value={reviewNote}
                  onChange={(event) => onNoteChange(event.target.value)}
                  maxLength={employerAccessNoteLimit}
                  rows={4}
                  disabled={saving}
                  aria-invalid={Boolean(reviewError)}
                  aria-describedby={
                    reviewError ? "review-note-error" : "review-note-count"
                  }
                  placeholder={c.notePlaceholder}
                  className={`bd-focus mt-2 w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-slate-950 placeholder:text-slate-400 disabled:opacity-60 ${
                    reviewError ? "border-rose-400" : "border-slate-200"
                  }`}
                />
                <span
                  id="review-note-count"
                  className="mt-1 block text-right text-xs font-semibold text-slate-400"
                >
                  {reviewNote.length}/{employerAccessNoteLimit} {c.characters}
                </span>
              </label>

              {reviewError ? (
                <p
                  id="review-note-error"
                  role="alert"
                  className="mt-2 flex items-center gap-2 text-sm font-bold text-rose-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {reviewError}
                </p>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={saving}
                  className="bd-focus min-h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:border-cyan-300 hover:text-slate-950 disabled:opacity-50"
                >
                  {c.cancel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={saving}
                  className={`bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white transition disabled:cursor-wait disabled:opacity-60 ${
                    decision === "rejected" || decision === "suspended"
                      ? "bg-rose-700 hover:bg-rose-800"
                      : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : decision === "verified" ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  ) : (
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                  )}
                  {saving ? c.saving : c.confirm}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "navy" | "amber" | "emerald" | "rose";
}) {
  const toneClass = {
    navy: "border-slate-200 bg-white text-[#071f3c]",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
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

function ReviewDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-b border-slate-200 p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
      <dt className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-bold leading-6 text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}

function NoteBlock({
  title,
  text,
  muted,
}: {
  title: string;
  text: string;
  muted: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/75 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">
        {title}
      </p>
      <p
        className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${
          muted ? "italic text-slate-400" : "text-slate-700"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function InlineDate({
  label,
  value,
  language,
  fallback,
}: {
  label: string;
  value: string;
  language: "en" | "tr";
  fallback: string;
}) {
  return (
    <div>
      <dt className="font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-slate-700">
        <time dateTime={value}>
          {formatDateTime(value, language, fallback)}
        </time>
      </dd>
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

function AccessDenied({
  c,
}: {
  c: (typeof copy)["en"] | (typeof copy)["tr"];
}) {
  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-4xl">
        <div className="bd-glass-card-strong overflow-hidden rounded-[30px]">
          <div className="h-1.5 bg-amber-400" />
          <div className="p-7 sm:p-10">
            <ShieldAlert className="h-10 w-10 text-amber-700" aria-hidden />
            <p className="bd-kicker mt-5">{c.private}</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
              {c.accessDenied}
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">
              {c.accessDeniedText}
            </p>
            <Link
              href="/dashboard"
              className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {c.dashboard}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function requestKey(item: EmployerRequest) {
  return `${item.userId}:${item.access.requestId}`;
}

function filterLabel(
  filter: RequestFilter,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  return c[filter];
}

function roleLabel(
  role: EmployerRole,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  return c[role];
}

function statusPresentation(
  status: EmployerAccessStatus,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  if (status === "pending") {
    return {
      label: c.pending,
      icon: Clock,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
      ruleClass: "bg-amber-400",
    };
  }

  if (status === "verified") {
    return {
      label: c.verified,
      icon: CheckCircle2,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
      ruleClass: "bg-emerald-500",
    };
  }

  if (status === "rejected") {
    return {
      label: c.rejected,
      icon: AlertCircle,
      badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
      ruleClass: "bg-rose-500",
    };
  }

  return {
    label: c.suspended,
    icon: Ban,
    badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
    ruleClass: "bg-slate-500",
  };
}

function decisionOptions(
  currentStatus: EmployerAccessStatus,
): EmployerAccessStatus[] {
  if (currentStatus === "pending") return ["verified", "rejected"];
  if (currentStatus === "verified") return ["suspended"];
  return ["verified"];
}

function decisionButtonLabel(
  decision: EmployerAccessStatus,
  currentStatus: EmployerAccessStatus,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  if (decision === "rejected") return c.reject;
  if (decision === "suspended") return c.suspend;
  if (currentStatus === "rejected" || currentStatus === "suspended") {
    return c.restore;
  }
  return c.approve;
}

function decisionTitle(
  decision: EmployerAccessStatus,
  currentStatus: EmployerAccessStatus,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  if (decision === "rejected") return c.decisionReject;
  if (decision === "suspended") return c.decisionSuspend;
  if (currentStatus === "rejected" || currentStatus === "suspended") {
    return c.decisionRestore;
  }
  return c.decisionApprove;
}

function decisionHelp(
  decision: EmployerAccessStatus,
  currentStatus: EmployerAccessStatus,
  c: (typeof copy)["en"] | (typeof copy)["tr"],
) {
  if (decision === "rejected") return c.rejectHelp;
  if (decision === "suspended") return c.suspendHelp;
  if (currentStatus === "rejected" || currentStatus === "suspended") {
    return c.restoreHelp;
  }
  return c.approveHelp;
}

function formatDate(
  value: string,
  language: "en" | "tr",
  fallback: string,
) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string,
  language: "en" | "tr",
  fallback: string,
) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
