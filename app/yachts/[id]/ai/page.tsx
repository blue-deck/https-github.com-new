"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle, Info } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type NotificationItem = {
  id: string;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export default function NotificationsPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  async function loadData() {
    if (!yachtId) return;

    const [{ data: notificationData }, { data: alertData }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("expiry_alerts")
        .select("*")
        .eq("yacht_id", yachtId)
        .neq("status", "resolved"),
    ]);

    setNotifications(notificationData || []);
    setAlerts(alertData || []);
  }

  useEffect(() => {
    loadData();
  }, [yachtId]);

  const stats = useMemo(() => {
    const unread = notifications.filter((item) => item.status !== "read").length;
    const critical = alerts.filter((item) => ["critical", "expired"].includes(item.alert_level)).length;
    const warnings = alerts.filter((item) => item.alert_level === "warning").length;
    return { unread, critical, warnings };
  }, [alerts, notifications]);

  const feed = notifications.length
    ? notifications
    : [
        {
          id: "empty",
          title: "No live notifications yet",
          message: "Generate operational notifications from the Notification Center when yacht activity changes.",
          type: "info",
          status: "read",
        },
      ];

  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck Alerts</p>
          <h1 className="mt-3 text-6xl font-black">Notifications Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Live operational notifications, expiry alerts and yacht system messages.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Total" value={String(notifications.length)} />
          <Stat title="Unread" value={String(stats.unread)} />
          <Stat title="Critical" value={String(stats.critical)} />
          <Stat title="Warnings" value={String(stats.warnings)} />
        </div>

        <div className="space-y-6">
          {feed.map((item) => {
            const Icon = iconFor(item.type || "", item.status || "");

            return (
              <div key={item.id} className="rounded-[32px] border border-white/10 bg-white/5 p-6">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-black">
                    <Icon className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-3xl font-black">{item.title || "Notification"}</h2>
                    <p className="mt-3 text-lg text-gray-400">{item.message || "No message"}</p>
                    {item.created_at && (
                      <p className="mt-3 text-sm text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function iconFor(type: string, status: string) {
  if (type.includes("expiry") || status === "unread") return AlertTriangle;
  if (status === "read") return CheckCircle;
  if (type.includes("info")) return Info;
  return Bell;
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-3xl font-black">{value}</h2>
    </div>
  );
}
