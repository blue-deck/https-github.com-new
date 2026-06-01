"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Printer, Ship, Users, Wallet, Wrench } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function ReportsPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [status, setStatus] = useState<any>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [engineering, setEngineering] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  function printPage() {
    window.print();
  }

  async function loadReport() {
    if (!yachtId) return;

    const [statusRes, crewRes, checklistRes, engineeringRes, fuelRes, expenseRes, alertRes] = await Promise.all([
      supabase.from("yacht_status").select("*").eq("yacht_id", yachtId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("yacht_crew_memberships").select("id,status,position,department").eq("yacht_id", yachtId),
      supabase.from("yacht_checklists").select("id,title,status,yacht_checklist_items(id,completed)").eq("yacht_id", yachtId),
      supabase.from("engineering_assets").select("*").eq("yacht_id", yachtId),
      supabase.from("fuel_logs").select("*").eq("yacht_id", yachtId),
      supabase.from("yacht_expenses").select("*").eq("yacht_id", yachtId),
      supabase.from("expiry_alerts").select("*").eq("yacht_id", yachtId).neq("status", "resolved"),
    ]);

    setStatus(statusRes.data || null);
    setCrew(crewRes.data || []);
    setChecklists(checklistRes.data || []);
    setEngineering(engineeringRes.data || []);
    setFuel(fuelRes.data || []);
    setExpenses(expenseRes.data || []);
    setAlerts(alertRes.data || []);
  }

  useEffect(() => {
    loadReport();
  }, [yachtId]);

  const summary = useMemo(() => {
    const tasks = checklists.flatMap((item: any) => item.yacht_checklist_items || []);
    const completed = tasks.filter((task: any) => task.completed).length;
    const overdueSystems = engineering.filter((asset) => {
      const remaining =
        Number(asset.last_service_hours || 0) +
        Number(asset.service_interval || 0) -
        Number(asset.current_hours || 0);
      return remaining <= 0;
    }).length;
    const financeTotal =
      fuel.reduce((sum, item) => sum + Number(item.total_cost || 0), 0) +
      expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { tasks, completed, overdueSystems, financeTotal };
  }, [checklists, engineering, expenses, fuel]);

  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck Reports</p>
          <h1 className="mt-3 text-6xl font-black">Reports & PDF Export</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Live captain reports, engineering summaries and operational PDF exports.
          </p>

          <button
            onClick={printPage}
            className="mt-8 flex items-center gap-3 rounded-2xl bg-cyan-400 px-7 py-5 text-lg font-black text-black"
          >
            <Printer />
            Print / Export PDF
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Report
            icon={<Ship />}
            title="Captain Daily Report"
            text={`${status?.operational_status || "Status not set"} · ${
              status?.current_location || "No location"
            } · owner ${status?.owner_onboard ? "onboard" : "not onboard"}.`}
          />
          <Report
            icon={<Wrench />}
            title="Engineering Report"
            text={`${engineering.length} systems tracked. ${summary.overdueSystems} systems are overdue for service.`}
          />
          <Report
            icon={<Users />}
            title="Crew Report"
            text={`${crew.length} crew records. ${summary.completed}/${summary.tasks.length} checklist tasks completed.`}
          />
          <Report
            icon={<Wallet />}
            title="Finance Report"
            text={`Recorded spend: €${summary.financeTotal.toFixed(0)}. Open compliance alerts: ${alerts.length}.`}
          />
        </div>
      </div>
    </main>
  );
}

function Report({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
        {icon}
      </div>

      <h2 className="text-4xl font-black">{title}</h2>
      <p className="mt-5 text-xl leading-relaxed text-gray-400">{text}</p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center gap-3 text-cyan-300">
          <FileText />
          Ready for PDF export
        </div>
      </div>
    </div>
  );
}
