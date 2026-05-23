"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type EngineHour = {
  id: string;
  engine_name: string | null;
  hours: number | null;
  created_at: string;
};

type MaintenanceSchedule = {
  id: string;
  title: string | null;
  system: string | null;
  interval_type: string | null;
  interval_hours: number | null;
  interval_months: number | null;
  last_done_hours: number | null;
  last_done_date: string | null;
  next_due_hours: number | null;
  next_due_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

type MaintenanceLog = {
  id: string;
  maintenance_id: string | null;
  completed_hours: number | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
};

export default function MaintenancePage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [engineHours, setEngineHours] = useState<EngineHour[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);

  const [title, setTitle] = useState("");
  const [system, setSystem] = useState("");
  const [intervalHours, setIntervalHours] = useState("");
  const [lastDoneHours, setLastDoneHours] = useState("");
  const [notes, setNotes] = useState("");

  const [engineName, setEngineName] = useState("");
  const [hours, setHours] = useState("");

  const [completionNotes, setCompletionNotes] = useState("");

  async function fetchData() {
    if (!yachtId) return;

    const { data: scheduleData, error: scheduleError } = await supabase
      .from("maintenance_schedules")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (scheduleError) {
      alert(scheduleError.message);
      return;
    }

    const { data: engineData, error: engineError } = await supabase
      .from("engine_hours")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (engineError) {
      alert(engineError.message);
      return;
    }

    const { data: logData, error: logError } = await supabase
      .from("maintenance_logs")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (logError) {
      alert(logError.message);
      return;
    }

    setSchedules(scheduleData || []);
    setEngineHours(engineData || []);
    setLogs(logData || []);
  }

  useEffect(() => {
    if (yachtId) fetchData();
  }, [yachtId]);

  function currentMaxHours() {
    if (engineHours.length === 0) return 0;

    return Math.max(
      ...engineHours.map((engine) => Number(engine.hours || 0))
    );
  }

  function remainingHours(item: MaintenanceSchedule) {
    const current = currentMaxHours();
    const due = Number(item.next_due_hours || 0);
    return due - current;
  }

  function statusLabel(item: MaintenanceSchedule) {
    const remaining = remainingHours(item);

    if (remaining < 0) return "OVERDUE";
    if (remaining <= 25) return "DUE SOON";
    return "GOOD";
  }

  function statusClass(item: MaintenanceSchedule) {
    const status = statusLabel(item);

    if (status === "OVERDUE") {
      return "bg-red-500/20 text-red-300 border-red-500/30";
    }

    if (status === "DUE SOON") {
      return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    }

    return "bg-green-500/20 text-green-300 border-green-500/30";
  }

  async function createMaintenance() {
    if (!title.trim()) {
      alert("Maintenance title is required");
      return;
    }

    const interval = Number(intervalHours || 0);
    const lastHours = Number(lastDoneHours || currentMaxHours());
    const nextDue = lastHours + interval;

    const { error } = await supabase.from("maintenance_schedules").insert({
      yacht_id: yachtId,
      title,
      system,
      interval_type: "hours",
      interval_hours: interval,
      last_done_hours: lastHours,
      next_due_hours: nextDue,
      notes,
      status: "active",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setSystem("");
    setIntervalHours("");
    setLastDoneHours("");
    setNotes("");

    fetchData();
  }

  async function saveEngineHours() {
    if (!engineName.trim() || !hours.trim()) {
      alert("Engine name and hours are required");
      return;
    }

    const { error } = await supabase.from("engine_hours").insert({
      yacht_id: yachtId,
      engine_name: engineName,
      hours: Number(hours),
    });

    if (error) {
      alert(error.message);
      return;
    }

    setEngineName("");
    setHours("");

    fetchData();
  }

  async function completeMaintenance(item: MaintenanceSchedule) {
    const currentHours = currentMaxHours();
    const interval = Number(item.interval_hours || 0);
    const nextDue = currentHours + interval;

    const { error: logError } = await supabase.from("maintenance_logs").insert({
      yacht_id: yachtId,
      maintenance_id: item.id,
      completed_hours: currentHours,
      completed_date: new Date().toISOString().slice(0, 10),
      notes: completionNotes,
    });

    if (logError) {
      alert(logError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("maintenance_schedules")
      .update({
        last_done_hours: currentHours,
        last_done_date: new Date().toISOString().slice(0, 10),
        next_due_hours: nextDue,
      })
      .eq("id", item.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    setCompletionNotes("");
    fetchData();
  }

  async function deleteMaintenance(id: string) {
    const ok = confirm("Delete this maintenance schedule?");
    if (!ok) return;

    const { error } = await supabase
      .from("maintenance_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  }

  return (
    <main className="min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Maintenance</p>

          <h1 className="mt-3 text-5xl font-bold">
            Maintenance Intelligence
          </h1>

          <p className="mt-4 text-gray-400">
            Track engine hours, due services, overdue jobs and completed
            maintenance history.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Current Hours</p>
            <h2 className="mt-4 text-5xl font-bold">{currentMaxHours()}h</h2>
          </div>

          <div className="rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Active Services</p>
            <h2 className="mt-4 text-5xl font-bold">{schedules.length}</h2>
          </div>

          <div className="rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Due Soon</p>
            <h2 className="mt-4 text-5xl font-bold">
              {
                schedules.filter(
                  (item) => statusLabel(item) === "DUE SOON"
                ).length
              }
            </h2>
          </div>

          <div className="rounded-3xl bg-white/5 p-6">
            <p className="text-gray-400">Overdue</p>
            <h2 className="mt-4 text-5xl font-bold">
              {
                schedules.filter(
                  (item) => statusLabel(item) === "OVERDUE"
                ).length
              }
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Create Service Schedule</h2>

            <div className="mt-8 space-y-4">
              <input
                placeholder="Generator Service"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <input
                placeholder="System: Generator / Port Engine / Watermaker"
                value={system}
                onChange={(event) => setSystem(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <input
                placeholder="Interval hours: 250"
                value={intervalHours}
                onChange={(event) => setIntervalHours(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <input
                placeholder={`Last done hours, default ${currentMaxHours()}h`}
                value={lastDoneHours}
                onChange={(event) => setLastDoneHours(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <textarea
                placeholder="Service notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="h-28 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <button
                onClick={createMaintenance}
                className="w-full rounded-2xl bg-blue-400 px-5 py-4 font-semibold text-black"
              >
                Create Schedule
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Engine Hours</h2>

            <div className="mt-8 space-y-4">
              <input
                placeholder="Port Engine"
                value={engineName}
                onChange={(event) => setEngineName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <input
                placeholder="1840"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <button
                onClick={saveEngineHours}
                className="w-full rounded-2xl bg-green-400 px-5 py-4 font-semibold text-black"
              >
                Save Engine Hours
              </button>
            </div>

            <div className="mt-8 space-y-4">
              {engineHours.map((engine) => (
                <div
                  key={engine.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <h3 className="text-2xl font-semibold">
                    {engine.engine_name}
                  </h3>

                  <p className="mt-2 text-gray-400">{engine.hours}h</p>
                </div>
              ))}

              {engineHours.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-gray-400">
                  No engine hours recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-white/5 p-8">
          <h2 className="text-3xl font-bold">Active Maintenance</h2>

          <div className="mt-6 space-y-4">
            {schedules.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-6"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-bold">
                        {item.title}
                      </h3>

                      <span
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusClass(
                          item
                        )}`}
                      >
                        {statusLabel(item)}
                      </span>
                    </div>

                    <p className="mt-2 text-gray-400">{item.system}</p>

                    <p className="mt-3 text-gray-400">
                      Every {item.interval_hours || 0}h
                    </p>

                    <p className="mt-1 text-gray-400">
                      Last done: {item.last_done_hours || 0}h
                    </p>

                    <p className="mt-1 text-yellow-300">
                      Next due: {item.next_due_hours || 0}h
                    </p>

                    <p className="mt-1 text-gray-300">
                      Remaining: {remainingHours(item)}h
                    </p>

                    {item.notes && (
                      <p className="mt-4 text-gray-400">{item.notes}</p>
                    )}
                  </div>

                  <div className="w-full max-w-xs space-y-3">
                    <textarea
                      placeholder="Completion notes"
                      value={completionNotes}
                      onChange={(event) =>
                        setCompletionNotes(event.target.value)
                      }
                      className="h-24 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
                    />

                    <button
                      onClick={() => completeMaintenance(item)}
                      className="w-full rounded-2xl bg-green-400 px-5 py-4 font-semibold text-black"
                    >
                      Mark Completed
                    </button>

                    <button
                      onClick={() => deleteMaintenance(item.id)}
                      className="w-full rounded-2xl border border-red-500/30 px-5 py-4 text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {schedules.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                No maintenance schedules yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-white/5 p-8">
          <h2 className="text-3xl font-bold">Maintenance History</h2>

          <div className="mt-6 space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <p className="font-semibold">
                  Completed at {log.completed_hours}h
                </p>

                <p className="mt-2 text-gray-400">
                  Date: {log.completed_date || "No date"}
                </p>

                {log.notes && (
                  <p className="mt-2 text-gray-400">{log.notes}</p>
                )}
              </div>
            ))}

            {logs.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                No maintenance history yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}