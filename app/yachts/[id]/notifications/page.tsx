"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function NotificationsPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [notifications, setNotifications] = useState<any[]>([]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setNotifications(data || []);
  }

  async function generateSmartNotifications() {
    const { data: alerts } = await supabase
      .from("expiry_alerts")
      .select("*")
      .eq("yacht_id", yachtId)
      .neq("status", "resolved");

    const { data: checklists } = await supabase
      .from("yacht_checklists")
      .select(`
        id,
        title,
        department,
        yacht_checklist_items (
          id,
          completed
        )
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    for (const alert of alerts || []) {
      await supabase.from("notifications").insert({
        yacht_id: yachtId,
        title: `Expiry Alert: ${alert.title}`,
        message: `${alert.alert_level} · expires on ${alert.expiry_date}`,
        type: "expiry",
      });
    }

    for (const checklist of checklists || []) {
      const items = checklist.yacht_checklist_items || [];
      const pendingCount = items.filter((item: any) => !item.completed).length;
      if (!pendingCount) continue;

      await supabase.from("notifications").insert({
        yacht_id: yachtId,
        title: `Pending Checklist: ${checklist.title}`,
        message: `${checklist.department || "Yacht"} checklist has ${pendingCount} open item${pendingCount === 1 ? "" : "s"}.`,
        type: "checklist",
      });
    }

    fetchNotifications();
  }

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", id);

    fetchNotifications();
  }

  useEffect(() => {
    if (yachtId) fetchNotifications();
  }, [yachtId]);

  return (
    <main className="min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-5xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Notifications</p>
          <h1 className="mt-3 text-5xl font-bold">Smart Notifications</h1>
          <p className="mt-4 text-gray-400">
            Generate operational alerts from pending tasks and expiry warnings.
          </p>

          <button
            onClick={generateSmartNotifications}
            className="mt-6 rounded-2xl bg-blue-400 px-6 py-4 font-semibold text-black"
          >
            Generate Smart Notifications
          </button>
        </div>

        <div className="mt-8 space-y-4">
          {notifications.map((note) => (
            <div
              key={note.id}
              className={`rounded-3xl border p-6 ${
                note.status === "unread"
                  ? "border-blue-500/30 bg-blue-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
                    {note.type}
                  </span>

                  <h2 className="mt-4 text-2xl font-bold">{note.title}</h2>

                  <p className="mt-2 text-gray-400">{note.message}</p>
                </div>

                <button
                  onClick={() => markRead(note.id)}
                  className="rounded-xl border border-white/10 px-4 py-2"
                >
                  Mark read
                </button>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="rounded-3xl bg-white/5 p-8 text-gray-400">
              No notifications yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
