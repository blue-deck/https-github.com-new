"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function NotificationCenterPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    if (!yachtId) return;

    const { data, error } = await supabase
      .from("global_notifications")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setNotifications(data || []);
  }

  useEffect(() => {
    loadNotifications();

    if (!yachtId) return;

    const channel = supabase
      .channel(`global_notifications_${yachtId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "global_notifications",
          filter: `yacht_id=eq.${yachtId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [yachtId]);

  async function createNotification(item: any) {
    const { error } = await supabase.from("global_notifications").insert({
      yacht_id: yachtId,
      title: item.title,
      message: item.message,
      category: item.category,
      severity: item.severity,
      status: "unread",
      source_table: item.source_table || null,
      source_id: item.source_id || null,
    });

    if (error) {
      alert(error.message);
    }
  }

  async function generateSmartNotifications() {
    setLoading(true);

    const { data: tasks } = await supabase
      .from("crew_tasks")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: expiryAlerts } = await supabase
      .from("expiry_alerts")
      .select("*")
      .eq("yacht_id", yachtId)
      .neq("status", "resolved");

    const { data: engineerReports } = await supabase
      .from("quick_engine_reports")
      .select("*")
      .eq("yacht_id", yachtId)
      .eq("status", "open");

    const { data: engineeringAssets } = await supabase
      .from("engineering_assets")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: voyages } = await supabase
      .from("voyages")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false })
      .limit(1);

    const pendingTasks = (tasks || []).filter((t: any) => t.status !== "completed");

    const items: any[] = [];

    pendingTasks.forEach((task: any) => {
      items.push({
        title: `Pending Task: ${task.title}`,
        message: task.description || "Crew task is still pending.",
        category: "crew",
        severity: "warning",
        source_table: "crew_tasks",
        source_id: task.id,
      });
    });

    (expiryAlerts || []).forEach((alert: any) => {
      items.push({
        title: `Expiry Alert: ${alert.title || alert.document_title || "Document"}`,
        message: `Compliance or expiry item requires attention.`,
        category: "compliance",
        severity: alert.severity === "critical" ? "critical" : "warning",
        source_table: "expiry_alerts",
        source_id: alert.id,
      });
    });

    (engineerReports || []).forEach((report: any) => {
      items.push({
        title: `Engineer Report: ${report.system_name}`,
        message: report.report_note || "Open engineering report.",
        category: "engineering",
        severity: report.issue_level === "critical" ? "critical" : report.issue_level === "warning" ? "warning" : "info",
        source_table: "quick_engine_reports",
        source_id: report.id,
      });
    });

    (engineeringAssets || []).forEach((asset: any) => {
      const current = Number(asset.current_hours || 0);
      const last = Number(asset.last_service_hours || 0);
      const interval = Number(asset.service_interval || 0);
      const remaining = last + interval - current;

      if (interval > 0 && remaining <= 0) {
        items.push({
          title: `${asset.name} Service Overdue`,
          message: `${asset.name} is overdue by ${Math.abs(remaining)} hours.`,
          category: "engineering",
          severity: "critical",
          source_table: "engineering_assets",
          source_id: asset.id,
        });
      }

      if (interval > 0 && remaining > 0 && remaining <= 25) {
        items.push({
          title: `${asset.name} Service Due Soon`,
          message: `${asset.name} service due in ${remaining} hours.`,
          category: "engineering",
          severity: "warning",
          source_table: "engineering_assets",
          source_id: asset.id,
        });
      }
    });

    const latestVoyage = voyages?.[0];

    if (latestVoyage) {
      const fuelEstimate = Number(latestVoyage.fuel_estimate || 0);
      const fuelRemaining = Number(latestVoyage.fuel_remaining || 0);

      if (fuelEstimate > 0 && fuelRemaining < fuelEstimate) {
        items.push({
          title: "Voyage Fuel Risk",
          message: `Fuel remaining (${fuelRemaining}L) is below voyage estimate (${fuelEstimate}L).`,
          category: "voyage",
          severity: "critical",
          source_table: "voyages",
          source_id: latestVoyage.id,
        });
      }
    }

    if (items.length === 0) {
      await createNotification({
        title: "System Check Complete",
        message: "No major operational warnings detected.",
        category: "system",
        severity: "info",
      });
    } else {
      for (const item of items) {
        await createNotification(item);
      }
    }

    setLoading(false);
    loadNotifications();
  }

  async function markRead(id: string) {
    await supabase
      .from("global_notifications")
      .update({ status: "read" })
      .eq("id", id);

    loadNotifications();
  }

  async function resolve(id: string) {
    await supabase
      .from("global_notifications")
      .update({ status: "resolved" })
      .eq("id", id);

    loadNotifications();
  }

  async function deleteNotification(id: string) {
    if (!confirm("Delete notification?")) return;

    await supabase
      .from("global_notifications")
      .delete()
      .eq("id", id);

    loadNotifications();
  }

  const stats = useMemo(() => {
    return {
      total: notifications.length,
      unread: notifications.filter((n) => n.status === "unread").length,
      critical: notifications.filter((n) => n.severity === "critical" && n.status !== "resolved").length,
      warning: notifications.filter((n) => n.severity === "warning" && n.status !== "resolved").length,
    };
  }, [notifications]);

  return (
    <main className="min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href={`/yachts/${yachtId}`} className="text-cyan-300">
          ← Back to yacht
        </Link>

        <div className="mt-6 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 p-10">
          <p className="text-cyan-300">BlueDeck Realtime System</p>

          <h1 className="mt-4 text-6xl font-black">
            Notification Center
          </h1>

          <p className="mt-4 max-w-4xl text-xl text-gray-300">
            Realtime operational notifications from crew tasks, engineering, expiry alerts, voyage risk and yacht events.
          </p>

          <button
            onClick={generateSmartNotifications}
            className="mt-6 rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-black"
          >
            {loading ? "Generating..." : "Generate Smart Notifications"}
          </button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Stat title="Total" value={stats.total} />
          <Stat title="Unread" value={stats.unread} />
          <Stat title="Critical" value={stats.critical} danger />
          <Stat title="Warnings" value={stats.warning} warning />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-3xl font-bold">Live Feed</h2>

            <div className="mt-6 space-y-4">
              <FeedStat label="Critical" value={stats.critical} tone="red" />
              <FeedStat label="Warnings" value={stats.warning} tone="yellow" />
              <FeedStat label="Unread" value={stats.unread} tone="cyan" />

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-gray-400">Realtime</p>
                <h3 className="mt-2 text-2xl font-bold text-green-300">Connected</h3>
                <p className="mt-2 text-sm text-gray-400">
                  This page listens for new notifications and updates automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-3xl border p-6 ${
                  item.severity === "critical"
                    ? "border-red-500/30 bg-red-500/10"
                    : item.severity === "warning"
                    ? "border-yellow-500/30 bg-yellow-500/10"
                    : "border-cyan-500/20 bg-cyan-500/10"
                }`}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Tag text={item.category || "general"} />
                      <Tag text={item.severity || "info"} />
                      <Tag text={item.status || "unread"} />
                    </div>

                    <h2 className="mt-4 text-3xl font-black">
                      {item.title}
                    </h2>

                    <p className="mt-3 text-lg text-gray-300">
                      {item.message}
                    </p>

                    <p className="mt-4 text-sm text-gray-500">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                    </p>
                  </div>

                  <div className="flex min-w-[150px] flex-col gap-3">
                    <button
                      onClick={() => markRead(item.id)}
                      className="rounded-xl bg-cyan-400 px-4 py-3 font-bold text-black"
                    >
                      Mark Read
                    </button>

                    <button
                      onClick={() => resolve(item.id)}
                      className="rounded-xl bg-green-400 px-4 py-3 font-bold text-black"
                    >
                      Resolve
                    </button>

                    <button
                      onClick={() => deleteNotification(item.id)}
                      className="rounded-xl border border-red-500/30 px-4 py-3 text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-400">
                No notifications yet. Click Generate Smart Notifications.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value, danger = false, warning = false }: any) {
  return (
    <div
      className={`rounded-3xl border p-6 ${
        danger
          ? "border-red-500/30 bg-red-500/10"
          : warning
          ? "border-yellow-500/30 bg-yellow-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-5xl font-black">{value}</h2>
    </div>
  );
}

function FeedStat({ label, value, tone }: any) {
  const color =
    tone === "red"
      ? "text-red-300"
      : tone === "yellow"
      ? "text-yellow-300"
      : "text-cyan-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <h3 className={`mt-2 text-3xl font-black ${color}`}>{value}</h3>
    </div>
  );
}

function Tag({ text }: any) {
  return (
    <span className="rounded-full bg-black/30 px-3 py-1 text-sm text-gray-200">
      {text}
    </span>
  );
}