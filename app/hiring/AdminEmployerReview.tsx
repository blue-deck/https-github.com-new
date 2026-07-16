"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Ship,
  X,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  EmployerVerificationStatus,
  PlatformEmployerReview,
  PlatformEmployerReviewYacht,
} from "../lib/jobs/types";
import { supabase } from "../lib/supabase";

const hiringLoginPath = `/login?next=${encodeURIComponent("/hiring")}`;

type ReviewNotice = {
  tone: "success" | "error";
  message: string;
};

export type EmployerReviewDecision = {
  employerId: string;
  status: Extract<EmployerVerificationStatus, "verified" | "rejected">;
  verifiedAt: string | null;
};

export function AdminEmployerReview({
  onDecision,
}: {
  onDecision?: (decision: EmployerReviewDecision) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [available, setAvailable] = useState(true);
  const [reviews, setReviews] = useState<PlatformEmployerReview[]>([]);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<ReviewNotice | null>(null);

  const loadReviews = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace(hiringLoginPath);
        return;
      }

      const response = await fetch("/api/hiring/admin/employers", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });
      const payload = await readPayload(response);

      if (response.status === 401) {
        window.location.replace(hiringLoginPath);
        return;
      }
      if (response.status === 403) {
        setAuthorized(false);
        return;
      }
      if (
        response.status === 404 ||
        response.status === 503 ||
        payload.available === false
      ) {
        setAvailable(false);
        setReviews([]);
        setTotal(0);
        return;
      }
      if (!response.ok) {
        throw new Error(
          payloadError(payload, "The employer review queue could not be loaded."),
        );
      }

      setAvailable(true);
      setReviews(normalizeReviews(payload.reviews));
      setTotal(readNumber(payload, ["total"]) || 0);
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The employer review queue could not be loaded.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function decide(
    review: PlatformEmployerReview,
    decision: "approve" | "reject",
  ) {
    const confirmed = window.confirm(
      decision === "approve"
        ? `Approve ${review.displayName} as a verified BlueDeck employer?`
        : `Decline verification for ${review.displayName}?`,
    );
    if (!confirmed) return;

    setUpdatingId(review.id);
    setNotice(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace(hiringLoginPath);
        return;
      }

      const response = await fetch(
        `/api/hiring/admin/employers/${encodeURIComponent(review.id)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            decision,
            internal_response: responses[review.id]?.trim() || null,
          }),
        },
      );
      const payload = await readPayload(response);

      if (response.status === 401) {
        window.location.replace(hiringLoginPath);
        return;
      }
      if (response.status === 403) {
        setAuthorized(false);
        return;
      }
      if (response.status === 404 || response.status === 503) {
        setAvailable(false);
        return;
      }
      if (!response.ok) {
        throw new Error(
          payloadError(
            payload,
            "The employer verification decision could not be saved.",
          ),
        );
      }

      const status = readString(payload, [
        "employer",
        "verificationStatus",
      ]);
      const verificationStatus =
        status === "verified" ? "verified" : "rejected";
      const verifiedAt =
        readString(payload, ["employer", "verifiedAt"]) || null;

      setReviews((current) =>
        current.filter((item) => item.id !== review.id),
      );
      setTotal((current) => Math.max(0, current - 1));
      setResponses((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      setNotice({
        tone: "success",
        message:
          readString(payload, ["message"]) ||
          (verificationStatus === "verified"
            ? "Employer verification approved."
            : "Employer verification declined."),
      });
      onDecision?.({
        employerId: review.id,
        status: verificationStatus,
        verifiedAt,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The employer verification decision could not be saved.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  if (!authorized) return null;

  if (loading) {
    return (
      <section
        aria-label="Platform employer verification"
        className="bd-glass-card-strong mt-6 rounded-[28px] p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 text-[#526b83]">
          <LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" />
          <p className="text-sm font-black">Loading employer review queue</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Platform employer verification"
      className="mt-6 overflow-hidden rounded-[30px] border border-cyan-200/80 bg-white/94 shadow-xl shadow-slate-900/6"
    >
      <header className="flex flex-col gap-5 border-b border-cyan-100 bg-[linear-gradient(135deg,#061b35_0%,#0a3154_62%,#07506a_100%)] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/12 text-cyan-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                Platform administration
              </p>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
                Restricted
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
              Employer verification queue
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Review professional identity and connected yacht evidence before
              allowing public job publishing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/14 bg-white/10 px-4 text-sm font-black">
            <Clock3 className="h-4 w-4 text-cyan-200" />
            <span data-i18n-ignore>{total}</span>
            <span>pending reviews</span>
          </span>
          <button
            type="button"
            onClick={() => void loadReviews(true)}
            disabled={refreshing || Boolean(updatingId)}
            aria-label="Refresh employer review queue"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/14 bg-white/10 text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      <div className="p-5 sm:p-7">
        {!available ? (
          <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-black">
                Employer review data is temporarily unavailable
              </h3>
              <p className="mt-1 text-sm leading-6 text-amber-900/75">
                No verification decision was changed. Refresh after the
                protected hiring database is available.
              </p>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            } ${available ? "" : "mt-4"}`}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <p>{notice.message}</p>
          </div>
        ) : null}

        {available && reviews.length === 0 ? (
          <div className={`${notice ? "mt-4" : ""} flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-emerald-950">
                Employer review queue is clear
              </h3>
              <p className="mt-1 text-sm leading-6 text-emerald-900/70">
                New verification requests will appear here after an eligible
                employer connects an owned yacht.
              </p>
            </div>
          </div>
        ) : null}

        {available && reviews.length > 0 ? (
          <div
            className={`${notice ? "mt-4" : ""} max-h-[720px] space-y-4 overflow-y-auto pr-1`}
          >
            {reviews.map((review) => {
              const updating = updatingId === review.id;
              return (
                <article
                  key={review.id}
                  className="rounded-[24px] border border-[#071f3c]/10 bg-[#f8fbfd] p-5 sm:p-6"
                >
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
                    <div className="min-w-0">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#071f3c] text-cyan-200">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3
                              data-i18n-ignore
                              className="break-words text-xl font-black text-[#071f3c] [overflow-wrap:anywhere]"
                            >
                              {review.displayName}
                            </h3>
                            <p
                              data-i18n-ignore
                              className="mt-1 break-words text-sm font-semibold text-[#60778d] [overflow-wrap:anywhere]"
                            >
                              {review.companyName ||
                                humanize(review.employerType)}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-amber-800">
                          <Clock3 className="h-3.5 w-3.5" />
                          Review pending
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <ReviewFact
                          icon={Ship}
                          label={
                            <>
                              <span data-i18n-ignore>{review.yachtCount}</span>
                              <span>
                                {review.yachtCount === 1
                                  ? "connected yacht"
                                  : "connected yachts"}
                              </span>
                            </>
                          }
                        />
                        <ReviewFact
                          icon={BriefcaseBusiness}
                          label={
                            <>
                              <span data-i18n-ignore>{review.jobCount}</span>
                              <span>
                                {review.jobCount === 1
                                  ? "job draft"
                                  : "job drafts"}
                              </span>
                            </>
                          }
                        />
                        {review.countryCode ? (
                          <ReviewFact
                            icon={ShieldCheck}
                            label={review.countryCode}
                            ignoreTranslation
                          />
                        ) : null}
                        <ReviewFact
                          icon={Clock3}
                          label={
                            <>
                              <span>Updated</span>
                              <span data-i18n-ignore>
                                {formatReviewDate(review.updatedAt)}
                              </span>
                            </>
                          }
                        />
                      </div>

                      {review.description ? (
                        <p
                          data-i18n-ignore
                          className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-[#526b83] [overflow-wrap:anywhere]"
                        >
                          {review.description}
                        </p>
                      ) : (
                        <p className="mt-4 text-sm italic text-[#7890a6]">
                          No professional introduction was supplied.
                        </p>
                      )}

                      <div className="mt-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7890a6]">
                          Connected yacht evidence
                        </p>
                        {review.yachts.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {review.yachts.map((yacht) => (
                              <YachtEvidence key={yacht.id} yacht={yacht} />
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-bold text-rose-700">
                            No owned yacht is connected to this account.
                          </p>
                        )}
                      </div>
                    </div>

                    <aside className="rounded-2xl border border-[#071f3c]/10 bg-white p-4 sm:p-5">
                      <label className="block">
                        <span className="text-sm font-black text-[#071f3c]">
                          Secure decision response
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[#7890a6]">
                          Optional context returned only in this protected admin
                          action. It is never added to public employer data.
                        </span>
                        <textarea
                          value={responses[review.id] || ""}
                          onChange={(event) =>
                            setResponses((current) => ({
                              ...current,
                              [review.id]: event.target.value.slice(0, 500),
                            }))
                          }
                          maxLength={500}
                          rows={3}
                          placeholder="Optional internal decision context"
                          className="mt-3 min-h-24 w-full resize-y rounded-xl border border-[#7d8da2] bg-white px-3.5 py-3 text-[16px] font-semibold text-[#071f3c] outline-none transition placeholder:text-[#8da0b1] focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/12"
                        />
                      </label>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => void decide(review, "reject")}
                          disabled={Boolean(updatingId)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updating ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => void decide(review, "approve")}
                          disabled={Boolean(updatingId)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updating ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <BadgeCheck className="h-4 w-4" />
                          )}
                          Approve
                        </button>
                      </div>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReviewFact({
  icon: Icon,
  label,
  ignoreTranslation = false,
}: {
  icon: typeof Ship;
  label: ReactNode;
  ignoreTranslation?: boolean;
}) {
  return (
    <span
      data-i18n-ignore={ignoreTranslation ? true : undefined}
      className="inline-flex items-center gap-2 rounded-full border border-[#071f3c]/10 bg-white px-3 py-1.5 text-xs font-black text-[#526b83]"
    >
      <Icon className="h-3.5 w-3.5 text-cyan-700" />
      {label}
    </span>
  );
}

function YachtEvidence({ yacht }: { yacht: PlatformEmployerReviewYacht }) {
  return (
    <span
      data-i18n-ignore
      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/80 px-3 py-2 text-xs font-black text-[#0b5269]"
    >
      <Ship className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {yacht.name}
        {yacht.model ? ` · ${yacht.model}` : ""}
        {yacht.flag ? ` · ${yacht.flag}` : ""}
      </span>
    </span>
  );
}

function normalizeReviews(value: unknown): PlatformEmployerReview[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = readString(item, ["id"]);
      const displayName = readString(item, ["displayName"]);
      if (!id || !displayName) return null;

      const yachtsValue = item.yachts;
      const yachts = Array.isArray(yachtsValue)
        ? yachtsValue
            .map((yacht) => {
              if (!isRecord(yacht)) return null;
              const yachtId = readString(yacht, ["id"]);
              const name = readString(yacht, ["name"]);
              if (!yachtId || !name) return null;
              return {
                id: yachtId,
                name,
                model: readString(yacht, ["model"]) || null,
                flag: readString(yacht, ["flag"]) || null,
              };
            })
            .filter(
              (yacht): yacht is PlatformEmployerReviewYacht => yacht !== null,
            )
        : [];

      return {
        id,
        displayName,
        companyName: readString(item, ["companyName"]) || null,
        employerType: readString(item, ["employerType"]) || "other",
        countryCode: readString(item, ["countryCode"]) || null,
        description: readString(item, ["description"]),
        verificationStatus: "pending" as const,
        createdAt: readString(item, ["createdAt"]) || null,
        updatedAt: readString(item, ["updatedAt"]) || null,
        yachtCount: readNumber(item, ["yachtCount"]) || yachts.length,
        yachts,
        jobCount: readNumber(item, ["jobCount"]) || 0,
      };
    })
    .filter(
      (review): review is PlatformEmployerReview => review !== null,
    );
}

function formatReviewDate(value: string | null) {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function payloadError(payload: Record<string, unknown>, fallback: string) {
  return readString(payload, ["error"]) || fallback;
}

function readString(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return "";
    current = current[key];
  }
  return typeof current === "string" ? current : "";
}

function readNumber(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === "number" && Number.isFinite(current)
    ? current
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
