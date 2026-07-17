"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function CommandCenterPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");

  const [status, setStatus] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [engineering, setEngineering] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [finance, setFinance] = useState({ fuel: 0, expenses: 0 });

  async function loadData() {
    if (!yachtId) return;

    const { data: statusData } = await supabase
      .from("yacht_status")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    const { data: positionData } = await supabase
      .from("yacht_positions")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: engData } = await supabase
      .from("engineering_assets")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: checklistData } = await supabase
      .from("yacht_checklists")
      .select(`
        id,
        title,
        status,
        yacht_checklist_items (
          id,
          task_text,
          completed
        )
      `)
      .eq("yacht_id", yachtId);

    const { data: alertData } = await supabase
      .from("expiry_alerts")
      .select("*")
      .eq("yacht_id", yachtId)
      .neq("status", "resolved");

    const { data: fuelData } = await supabase
      .from("fuel_logs")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: expenseData } = await supabase
      .from("yacht_expenses")
      .select("*")
      .eq("yacht_id", yachtId);

    setStatus(statusData || null);
    setPosition(positionData || null);
    setEngineering(engData || []);
    setTasks(
      (checklistData || []).flatMap((checklist: any) =>
        (checklist.yacht_checklist_items || []).map((item: any) => ({
          ...item,
          title: item.task_text || checklist.title,
          status: item.completed ? "completed" : "pending",
        }))
      )
    );
    setAlerts(alertData || []);

    setFinance({
      fuel: (fuelData || []).reduce((s, i) => s + Number(i.total_cost || 0), 0),
      expenses: (expenseData || []).reduce((s, i) => s + Number(i.amount || 0), 0),
    });
  }

  useEffect(() => {
    loadData();
  }, [yachtId]);

  function hoursUntilService(asset: any) {
    return (
      Number(asset.last_service_hours || 0) +
      Number(asset.service_interval || 0) -
      Number(asset.current_hours || 0)
    );
  }

  const overdueSystems = engineering.filter((a) => hoursUntilService(a) <= 0);
  const dueSoonSystems = engineering.filter((a) => {
    const h = hoursUntilService(a);
    return h > 0 && h <= 25;
  });
  const pendingTasks = tasks.filter((t) => t.status !== "completed");

  const commandRisks = [
    ...overdueSystems.map((a) => ({
      title: `${a.name} overdue`,
      text: `Service overdue by ${Math.abs(hoursUntilService(a))} hours.`,
      severity: "critical",
    })),
    ...dueSoonSystems.map((a) => ({
      title: `${a.name} service soon`,
      text: `Service due in ${hoursUntilService(a)} hours.`,
      severity: "warning",
    })),
    ...(pendingTasks.length
      ? [
          {
            title: "Crew tasks pending",
            text: `${pendingTasks.length} crew tasks still open.`,
            severity: "warning",
          },
        ]
      : []),
    ...(alerts.length
      ? [
          {
            title: "Compliance alerts",
            text: `${alerts.length} unresolved expiry/compliance alerts.`,
            severity: "critical",
          },
        ]
      : []),
  ];

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href={`/yachts/${yachtId}`} className="text-cyan-300">
          ← Back to yacht
        </Link>

        <div className="bd-page-hero mt-6 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 p-10">
          <p className="text-cyan-300">BlueDeck Command System</p>
          <h1 className="mt-4 text-6xl font-black">Captain Command Center</h1>
          <p className="mt-4 max-w-3xl text-xl text-gray-300">
            One-screen captain overview for yacht status, engineering, finance, crew and risks.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Badge text={status?.status || "Status not set"} />
            <Badge text={position?.location_name || status?.location || "No location"} />
            <Badge text={status?.owner_onboard ? "Owner Onboard" : "Crew Mode"} />
            <Badge text={status?.guest_mode ? "Guest Mode" : "Private Mode"} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-6">
          <Stat title="Speed" value={`${position?.speed || 0} kn`} />
          <Stat title="Heading" value={`${position?.heading || 0}°`} />
          <Stat title="Pending" value={pendingTasks.length} />
          <Stat title="Overdue" value={overdueSystems.length} danger />
          <Stat title="Alerts" value={alerts.length} danger />
          <Stat title="Cost" value={`€${(finance.fuel + finance.expenses).toFixed(0)}`} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Panel title="Live Vessel">
            <BigText>{position?.location_name || status?.location || "No position"}</BigText>
            <p className="mt-3 text-gray-400">
              {position?.latitude || "-"}, {position?.longitude || "-"}
            </p>
            <p className="mt-2 text-gray-400">
              {position?.speed || 0} kn · {position?.heading || 0}°
            </p>
          </Panel>

          <Panel title="Finance">
            <BigText>€{(finance.fuel + finance.expenses).toFixed(0)}</BigText>
            <p className="mt-3 text-gray-400">Fuel: €{finance.fuel.toFixed(0)}</p>
            <p className="mt-2 text-gray-400">Expenses: €{finance.expenses.toFixed(0)}</p>
          </Panel>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Panel title="AI Captain Risks">
            <div className="space-y-4">
              {commandRisks.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-5 ${
                    r.severity === "critical"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-yellow-500/30 bg-yellow-500/10"
                  }`}
                >
                  <h3 className="text-2xl font-bold">{r.title}</h3>
                  <p className="mt-2 text-gray-300">{r.text}</p>
                </div>
              ))}

              {commandRisks.length === 0 && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
                  No major operational risks detected.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Engineering Watch">
            <div className="space-y-4">
              {engineering.map((asset) => {
                const remaining = hoursUntilService(asset);
                return (
                  <div
                    key={asset.id}
                    className={`rounded-2xl border p-5 ${
                      remaining <= 0
                        ? "border-red-500/30 bg-red-500/10"
                        : remaining <= 25
                        ? "border-yellow-500/30 bg-yellow-500/10"
                        : "border-green-500/30 bg-green-500/10"
                    }`}
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold">{asset.name}</h3>
                        <p className="mt-1 text-gray-400">{asset.asset_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black">{asset.current_hours}h</p>
                        <p className="text-sm">
                          {remaining <= 0
                            ? `Overdue ${Math.abs(remaining)}h`
                            : `${remaining}h left`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {engineering.length === 0 && (
                <div className="rounded-2xl border border-white/10 p-5 text-gray-400">
                  No engineering systems.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Quick href={`/yachts/${yachtId}/map`} title="Map" />
          <Quick href={`/yachts/${yachtId}/finance`} title="Finance" />
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value, danger = false }: any) {
  return (
    <div className={`rounded-3xl border p-6 ${danger ? "border-red-500/30 bg-red-500/10" : "bd-app-card border-white/10 bg-white/5"}`}>
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-3 text-4xl font-black">{value}</h2>
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">
      <h2 className="text-3xl font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BigText({ children }: any) {
  return <h3 className="text-4xl font-black">{children}</h3>;
}

function Badge({ text }: any) {
  return <span className="rounded-full bg-black/30 px-4 py-2 text-sm">{text}</span>;
}

function Quick({ href, title }: any) {
  return (
    <Link href={href} className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-xl font-bold hover:border-cyan-400/50">
      {title}
    </Link>
  );
}
