"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

export default function AlertsPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [documents, setDocuments] = useState<YachtDocument[]>([]);
  const [loading, setLoading] = useState(true);

  function alertText(dateString: string | null) {
    const days = daysUntilExpiry(dateString);

    if (days === null) return "No expiry date";
    if (days < 0) return `Expired ${Math.abs(days)} days ago`;
    if (days === 0) return "Expires today";

    return `Expires in ${days} days`;
  }

  function alertClass(level: string | null) {
    if (level === "expired") {
      return "border-red-500/40 bg-red-500/10 text-red-300";
    }

    if (level === "critical") {
      return "border-orange-500/40 bg-orange-500/10 text-orange-300";
    }

    if (level === "warning") {
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
    }

    return "border-green-500/40 bg-green-500/10 text-green-300";
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

    fetchData();
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

  if (loading) {
    return (
      <main className="bd-app-page min-h-screen bg-[#081120] p-10 text-white">
        Loading expiry alerts...
      </main>
    );
  }

  return (
    <main className="bd-app-page min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Expiry Monitoring</p>

          <h1 className="mt-3 text-5xl font-bold">Expiry Alerts</h1>

          <p className="mt-4 text-gray-400">
            Track expiring yacht papers, insurance, crew documents,
            certificates and compliance items.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`/yachts/${yachtId}/documents`}
              className="rounded-2xl bg-blue-400 px-6 py-4 font-semibold text-black"
            >
              Go to Documents
            </a>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Documents with expiry dates found: {documents.length}
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <div className="bd-app-card rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Expired</p>
            <h2 className="mt-4 text-5xl font-bold text-red-300">
              {expired}
            </h2>
          </div>

          <div className="bd-app-card rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Critical</p>
            <h2 className="mt-4 text-5xl font-bold text-orange-300">
              {critical}
            </h2>
          </div>

          <div className="bd-app-card rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Warning</p>
            <h2 className="mt-4 text-5xl font-bold text-yellow-300">
              {warning}
            </h2>
          </div>

          <div className="bd-app-card rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Normal</p>
            <h2 className="mt-4 text-5xl font-bold text-green-300">
              {normal}
            </h2>
          </div>
        </div>

        <div className="bd-app-card mt-8 rounded-3xl bg-white/5 p-8">
          <h2 className="text-3xl font-bold">Active Alerts</h2>

          <div className="mt-6 space-y-4">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-2xl border p-6 ${alertClass(
                  alert.alert_level
                )}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {alert.title}
                    </h3>

                    <p className="mt-2">
                      {alert.source_type} · {alert.expiry_date}
                    </p>

                    <p className="mt-2 font-semibold">
                      {alertText(alert.expiry_date)}
                    </p>
                  </div>

                  <button
                    onClick={() => markResolved(alert)}
                    className="rounded-xl border border-white/20 px-5 py-3 text-white"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}

            {activeAlerts.length === 0 && (
              <div className="bd-app-card rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                No active expiry alerts. Documents will appear automatically
                three months before their expiry date.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
