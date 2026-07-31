"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  calculateExpiryAlertLevel,
  expiryAlertWindowEndIso,
} from "../../../lib/expiryAlerts";
import { supabase } from "../../../lib/supabase";

export default function TimelinePage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [events, setEvents] = useState<any[]>([]);

  async function fetchTimeline() {
    const timeline: any[] = [];

    const { data: checklists } = await supabase
      .from("yacht_checklists")
      .select(`
        id,
        title,
        department,
        frequency,
        status,
        created_at,
        yacht_checklist_items (
          id,
          completed
        )
      `)
      .eq("yacht_id", yachtId);

    const { data: documents } = await supabase
      .from("yacht_documents")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: alerts } = await supabase
      .from("expiry_alerts")
      .select("*")
      .eq("yacht_id", yachtId)
      .lte("expiry_date", expiryAlertWindowEndIso())
      .neq("status", "resolved");

    (checklists || []).forEach((item) => {
      const tasks = item.yacht_checklist_items || [];
      const completed = tasks.filter((task: any) => task.completed).length;
      timeline.push({
        time: item.created_at,
        title: item.title,
        type: "Checklist",
        message: `${item.department || "Yacht"} · ${item.frequency || "Assigned"} · ${completed}/${tasks.length} complete`,
      });
    });

    (documents || []).forEach((item) =>
      timeline.push({
        time: item.created_at,
        title: item.title,
        type: "Document",
        message: `Document expiry: ${item.expiry_date || "No expiry"}`,
      })
    );

    (alerts || []).forEach((item) =>
      timeline.push({
        time: item.created_at,
        title: item.title,
        type: "Alert",
        message: `${calculateExpiryAlertLevel(item.expiry_date)} · ${item.expiry_date}`,
      })
    );

    timeline.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    setEvents(timeline);
  }

  useEffect(() => {
    if (yachtId) fetchTimeline();
  }, [yachtId]);

  return (
    <main className="bd-app-page min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-5xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Live Operations</p>
          <h1 className="mt-3 text-5xl font-bold">Captain Timeline</h1>
          <p className="mt-4 text-gray-400">
            A live operational feed of tasks, checklists, documents and alerts.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {events.map((event, index) => (
            <div
              key={index}
              className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-300">
                    {event.type}
                  </span>

                  <h2 className="mt-4 text-2xl font-bold">{event.title}</h2>

                  <p className="mt-2 text-gray-400">{event.message}</p>
                </div>

                <p className="text-sm text-gray-500">
                  {new Date(event.time).toLocaleString()}
                </p>
              </div>
            </div>
          ))}

          {events.length === 0 && (
            <div className="bd-app-card rounded-3xl bg-white/5 p-8 text-gray-400">
              No timeline activity yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
