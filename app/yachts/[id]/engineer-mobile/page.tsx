"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function EngineerMobilePage() {
  const yachtId = usePathname().split("/")[2];

  const [assets, setAssets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  const [reportedBy, setReportedBy] = useState("");
  const [systemName, setSystemName] = useState("");
  const [issueLevel, setIssueLevel] = useState("normal");
  const [reportNote, setReportNote] = useState("");

  async function fetchData() {
    const { data: assetData } = await supabase
      .from("engineering_assets")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    const { data: reportData } = await supabase
      .from("quick_engine_reports")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setAssets(assetData || []);
    setReports(reportData || []);
  }

  useEffect(() => {
    if (yachtId) fetchData();
  }, [yachtId]);

  function hoursUntilService(asset: any) {
    return (
      Number(asset.last_service_hours || 0) +
      Number(asset.service_interval || 0) -
      Number(asset.current_hours || 0)
    );
  }

  async function submitReport() {
    if (!systemName || !reportNote) {
      alert("System and report note required");
      return;
    }

    const { error } = await supabase.from("quick_engine_reports").insert({
      yacht_id: yachtId,
      reported_by: reportedBy,
      system_name: systemName,
      issue_level: issueLevel,
      report_note: reportNote,
      status: "open",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSystemName("");
    setIssueLevel("normal");
    setReportNote("");
    fetchData();
  }

  async function closeReport(id: string) {
    await supabase
      .from("quick_engine_reports")
      .update({ status: "closed" })
      .eq("id", id);

    fetchData();
  }

  async function quickUpdateHours(asset: any) {
    const value = prompt("New hours:", String(asset.current_hours || 0));
    if (!value) return;

    await supabase
      .from("engineering_assets")
      .update({ current_hours: Number(value) })
      .eq("id", asset.id);

    fetchData();
  }

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-4 pb-28 text-white">
      <div className="mx-auto max-w-md">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back
        </a>

        <div className="bd-page-hero mt-5 rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/20 to-green-500/10 p-7">
          <p className="text-sm text-gray-400">BlueDeck Mobile</p>
          <h1 className="mt-3 text-4xl font-black">Engineer App</h1>
          <p className="mt-3 text-gray-400">
            Mobile engineering checks, service countdown and quick issue reports.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat title="Systems" value={assets.length} />
          <Stat
            title="Overdue"
            value={assets.filter((a) => hoursUntilService(a) <= 0).length}
            danger
          />
          <Stat title="Reports" value={reports.length} />
        </div>

        <div className="bd-app-card mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-bold">Quick Report</h2>

          <div className="mt-4 space-y-3">
            <input
              placeholder="Reported by"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="w-full rounded-2xl bg-white/10 p-4 outline-none"
            />

            <input
              placeholder="System name"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="w-full rounded-2xl bg-white/10 p-4 outline-none"
            />

            <select
              value={issueLevel}
              onChange={(e) => setIssueLevel(e.target.value)}
              className="w-full rounded-2xl bg-white/10 p-4 outline-none"
            >
              <option>normal</option>
              <option>warning</option>
              <option>critical</option>
            </select>

            <textarea
              placeholder="Report note"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              className="h-28 w-full rounded-2xl bg-white/10 p-4 outline-none"
            />

            <button
              onClick={submitReport}
              className="w-full rounded-2xl bg-green-400 py-4 font-bold text-black"
            >
              Submit Engineer Report
            </button>
          </div>
        </div>

        <div className="bd-app-card mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-bold">Systems</h2>

          <div className="mt-4 space-y-3">
            {assets.map((asset) => {
              const remaining = hoursUntilService(asset);

              return (
                <div
                  key={asset.id}
                  className={`rounded-2xl border p-4 ${
                    remaining <= 0
                      ? "border-red-500/30 bg-red-500/10"
                      : remaining <= 25
                      ? "border-yellow-500/30 bg-yellow-500/10"
                      : "border-green-500/30 bg-green-500/10"
                  }`}
                >
                  <p className="text-xs uppercase opacity-70">
                    {asset.asset_type}
                  </p>

                  <h3 className="mt-1 text-xl font-bold">{asset.name}</h3>

                  <p className="mt-2 text-3xl font-black">
                    {asset.current_hours}h
                  </p>

                  <p className="mt-2 text-sm">
                    {remaining <= 0
                      ? `Overdue by ${Math.abs(remaining)}h`
                      : `Service in ${remaining}h`}
                  </p>

                  <button
                    onClick={() => quickUpdateHours(asset)}
                    className="mt-3 rounded-xl bg-white/20 px-4 py-2 font-bold"
                  >
                    Update Hours
                  </button>
                </div>
              );
            })}

            {assets.length === 0 && (
              <div className="rounded-2xl border border-white/10 p-5 text-gray-400">
                No engineering systems yet.
              </div>
            )}
          </div>
        </div>

        <div className="bd-app-card mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-bold">Reports</h2>

          <div className="mt-4 space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`rounded-2xl border p-4 ${
                  report.issue_level === "critical"
                    ? "border-red-500/30 bg-red-500/10"
                    : report.issue_level === "warning"
                    ? "border-yellow-500/30 bg-yellow-500/10"
                    : "bd-app-card border-white/10 bg-black/20"
                }`}
              >
                <p className="text-xs uppercase opacity-70">
                  {report.issue_level}
                </p>

                <h3 className="mt-1 text-xl font-bold">
                  {report.system_name}
                </h3>

                <p className="mt-2 text-sm text-gray-300">
                  {report.report_note}
                </p>

                <p className="mt-2 text-xs text-gray-500">
                  {report.reported_by || "Unknown"} · {report.status}
                </p>

                {report.status !== "closed" && (
                  <button
                    onClick={() => closeReport(report.id)}
                    className="mt-3 rounded-xl bg-green-400 px-4 py-2 font-bold text-black"
                  >
                    Close
                  </button>
                )}
              </div>
            ))}

            {reports.length === 0 && (
              <div className="rounded-2xl border border-white/10 p-5 text-gray-400">
                No reports yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value, danger = false }: any) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        danger ? "border-red-500/30 bg-red-500/10" : "bd-app-card border-white/10 bg-white/5"
      }`}
    >
      <p className="text-xs text-gray-400">{title}</p>
      <h2 className="mt-2 text-3xl font-black">{value}</h2>
    </div>
  );
}
