"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileText,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { formatDateForDisplay } from "../../../components/DateTextField";
import {
  calculateExpiryAlertLevel,
  daysUntilExpiry,
  expiryAlertWindowEndIso,
  isInsideThreeMonthAlertWindow,
} from "../../../lib/expiryAlerts";
import { supabase } from "../../../lib/supabase";

type AlertItem = {
  id: string;
  title: string | null;
  expiry_date: string | null;
  source_type: string | null;
  source_id: string | null;
  alert_level: string | null;
  status: string | null;
};

type YachtDocument = {
  id: string;
  title: string | null;
  file_name: string | null;
  expiry_date: string | null;
};

const alertTones = {
  expired: {
    label: "Expired",
    panel: "border-rose-200 bg-rose-50/50",
    icon: "bg-rose-100 text-rose-700",
    badge: "bg-rose-100 text-rose-800",
    accent: "text-rose-700",
  },
  critical: {
    label: "Critical",
    panel: "border-orange-200 bg-orange-50/50",
    icon: "bg-orange-100 text-orange-700",
    badge: "bg-orange-100 text-orange-800",
    accent: "text-orange-700",
  },
  warning: {
    label: "Warning",
    panel: "border-amber-200 bg-amber-50/50",
    icon: "bg-amber-100 text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    accent: "text-amber-700",
  },
  normal: {
    label: "Upcoming",
    panel: "border-cyan-200 bg-cyan-50/50",
    icon: "bg-cyan-100 text-cyan-800",
    badge: "bg-cyan-100 text-cyan-900",
    accent: "text-cyan-800",
  },
} as const;

function getAlertTone(level: string | null) {
  if (level === "expired") return alertTones.expired;
  if (level === "critical") return alertTones.critical;
  if (level === "warning") return alertTones.warning;
  return alertTones.normal;
}

function formatSourceType(sourceType: string | null) {
  if (!sourceType) return "Yacht record";

  return sourceType
    .replaceAll("_", " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

export default function AlertsPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [documents, setDocuments] = useState<YachtDocument[]>([]);
  const [loading, setLoading] = useState(true);

  function alertText(dateString: string | null) {
    const days = daysUntilExpiry(dateString);

    if (days === null) return "No expiry date";
    if (days < 0) {
      const elapsedDays = Math.abs(days);
      return `Expired ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
    }
    if (days === 0) return "Expires today";

    return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
  }

  async function fetchData() {
    if (!yachtId) return;

    setLoading(true);

    const { data: documentData, error: documentError } = await supabase
      .from("yacht_documents")
      .select("*")
      .eq("yacht_id", yachtId)
      .not("expiry_date", "is", null);

    if (documentError) {
      alert(documentError.message);
      setLoading(false);
      return;
    }

    const documentRows = (documentData || []) as YachtDocument[];
    setDocuments(documentRows);

    const { data: alertData, error: alertError } = await supabase
      .from("expiry_alerts")
      .select("*")
      .eq("yacht_id", yachtId)
      .lte("expiry_date", expiryAlertWindowEndIso())
      .order("expiry_date", { ascending: true });

    if (alertError) {
      alert(alertError.message);
      setLoading(false);
      return;
    }

    const persistedAlerts = (alertData || []) as AlertItem[];
    const persistedDocumentAlerts = new Map(
      persistedAlerts
        .filter(
          (item) => item.source_type === "document" && item.source_id,
        )
        .map((item) => [item.source_id, item]),
    );
    const automaticDocumentAlerts = documentRows
      .filter((document) =>
        isInsideThreeMonthAlertWindow(document.expiry_date),
      )
      .map(
        (document): AlertItem =>
          persistedDocumentAlerts.get(document.id) || {
            id: `document:${document.id}`,
            title:
              document.title ||
              document.file_name ||
              "Untitled document",
            expiry_date: document.expiry_date,
            source_type: "document",
            source_id: document.id,
            alert_level: calculateExpiryAlertLevel(document.expiry_date),
            status: "active",
          },
      );
    const nonDocumentAlerts = persistedAlerts.filter(
      (item) => item.source_type !== "document",
    );

    setAlerts(
      [...automaticDocumentAlerts, ...nonDocumentAlerts].sort((first, second) =>
        String(first.expiry_date || "").localeCompare(
          String(second.expiry_date || ""),
        ),
      ),
    );
    setLoading(false);
  }

  async function markResolved(alertItem: AlertItem) {
    const result = alertItem.id.startsWith("document:")
      ? await saveResolvedDocumentAlert(alertItem)
      : await supabase
          .from("expiry_alerts")
          .update({ status: "resolved" })
          .eq("id", alertItem.id);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    await fetchData();
  }

  async function saveResolvedDocumentAlert(alertItem: AlertItem) {
    if (!alertItem.source_id || !alertItem.expiry_date) {
      return { error: new Error("This document alert could not be resolved.") };
    }

    const payload = {
      yacht_id: yachtId,
      source_type: "document",
      source_id: alertItem.source_id,
      title: alertItem.title || "Untitled document",
      expiry_date: alertItem.expiry_date,
      alert_level: calculateExpiryAlertLevel(alertItem.expiry_date),
      status: "resolved",
    };
    const existing = await supabase
      .from("expiry_alerts")
      .select("id")
      .eq("yacht_id", yachtId)
      .eq("source_type", "document")
      .eq("source_id", alertItem.source_id)
      .limit(1);

    if (existing.error) return { error: existing.error };

    if (existing.data?.[0]?.id) {
      return supabase
        .from("expiry_alerts")
        .update(payload)
        .eq("id", existing.data[0].id);
    }

    return supabase.from("expiry_alerts").insert(payload);
  }

  useEffect(() => {
    if (yachtId) fetchData();
  }, [yachtId]);

  const activeAlerts = alerts
    .filter(
      (alert) =>
        alert.status !== "resolved" &&
        isInsideThreeMonthAlertWindow(alert.expiry_date),
    )
    .map((alert) => ({
      ...alert,
      alert_level: calculateExpiryAlertLevel(alert.expiry_date),
    }));

  const expired = activeAlerts.filter(
    (alert) => alert.alert_level === "expired"
  ).length;

  const critical = activeAlerts.filter(
    (alert) => alert.alert_level === "critical"
  ).length;

  const warning = activeAlerts.filter(
    (alert) => alert.alert_level === "warning"
  ).length;

  const normal = activeAlerts.filter(
    (alert) => alert.alert_level === "normal"
  ).length;

  const summaryCards = [
    {
      label: "Expired",
      description: "Past due",
      value: expired,
      icon: CircleAlert,
      iconClassName: "bg-rose-50 text-rose-700",
      valueClassName: "text-rose-700",
    },
    {
      label: "Critical",
      description: "Due within 14 days",
      value: critical,
      icon: TriangleAlert,
      iconClassName: "bg-orange-50 text-orange-700",
      valueClassName: "text-orange-700",
    },
    {
      label: "Warning",
      description: "Due within 30 days",
      value: warning,
      icon: CalendarClock,
      iconClassName: "bg-amber-50 text-amber-700",
      valueClassName: "text-amber-700",
    },
    {
      label: "Upcoming",
      description: "Due within 3 months",
      value: normal,
      icon: ShieldCheck,
      iconClassName: "bg-cyan-50 text-cyan-800",
      valueClassName: "text-cyan-800",
    },
  ];

  if (loading) {
    return (
      <main className="bd-app-page min-h-screen bg-[#f4f7fb] px-4 py-10 text-slate-900 sm:px-6 lg:px-10">
        <div className="mx-auto flex min-h-[420px] max-w-7xl items-center justify-center">
          <div className="text-center">
            <LoaderCircle
              className="mx-auto h-8 w-8 animate-spin text-cyan-800"
              aria-hidden
            />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Loading expiry alerts...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page min-h-screen bg-[#f4f7fb] px-4 pb-20 pt-6 text-slate-900 sm:px-6 sm:pt-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/yachts/${yachtId}`}
          className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-slate-600 transition hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to yacht
        </Link>

        <header className="mt-3 flex flex-col gap-5 border-b border-slate-200 pb-7 sm:mt-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
              <BellRing className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">
                Expiry Monitoring
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Expiry Alerts
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Track yacht papers, insurance, crew documents, certificates
                and compliance items before they expire.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm">
              <FileText className="h-4 w-4 text-cyan-800" aria-hidden />
              {documents.length}{" "}
              {documents.length === 1
                ? "document monitored"
                : "documents monitored"}
            </div>
            <Link
              href={`/yachts/${yachtId}/documents`}
              className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-cyan-900"
            >
              Manage documents
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </header>

        <section
          aria-label="Expiry alert summary"
          className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {summaryCards.map((card) => {
            const SummaryIcon = card.icon;

            return (
              <article
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {card.label}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {card.description}
                    </p>
                  </div>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.iconClassName}`}
                  >
                    <SummaryIcon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <p
                  className={`mt-5 text-3xl font-black tracking-tight ${card.valueClassName}`}
                >
                  {card.value}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
                <BellRing className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Active Alerts
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Documents that need attention within the three-month window.
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {activeAlerts.length} active
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {activeAlerts.map((alert) => {
              const tone = getAlertTone(alert.alert_level);

              return (
                <article
                  key={alert.id}
                  className={`rounded-xl border p-4 sm:p-5 ${tone.panel}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
                      >
                        <CalendarClock className="h-5 w-5" aria-hidden />
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-black ${tone.badge}`}
                          >
                            {tone.label}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {formatSourceType(alert.source_type)}
                          </span>
                        </div>

                        <h3 className="mt-2 truncate text-base font-black text-slate-950 sm:text-lg">
                          {alert.title || "Untitled record"}
                        </h3>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                            <CalendarClock
                              className="h-4 w-4 text-slate-400"
                              aria-hidden
                            />
                            {alert.expiry_date
                              ? formatDateForDisplay(alert.expiry_date)
                              : "No expiry date"}
                          </span>
                          <span className={`font-black ${tone.accent}`}>
                            {alertText(alert.expiry_date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void markResolved(alert)}
                      className="bd-focus inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Mark resolved
                    </button>
                  </div>
                </article>
              );
            })}

            {activeAlerts.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
                <div>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
                    <ShieldCheck className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-black text-slate-800">
                    All clear
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    No active expiry alerts. Documents will appear here
                    automatically three months before their expiry date.
                  </p>
                  <Link
                    href={`/yachts/${yachtId}/documents`}
                    className="bd-focus mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black text-cyan-800 transition hover:bg-cyan-50"
                  >
                    Review documents
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            ) : null}
        </div>
        </section>
      </div>
    </main>
  );
}
