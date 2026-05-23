"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function CrewMobilePage() {
  const yachtId = usePathname().split("/")[2];

  const [email, setEmail] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftType, setShiftType] = useState("Day Shift");
  const [notes, setNotes] = useState("");

  async function fetchData() {
    const { data: taskData } = await supabase
      .from("crew_tasks")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    const { data: shiftData } = await supabase
      .from("crew_shift_logs")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setTasks(taskData || []);
    setShifts(shiftData || []);
  }

  useEffect(() => {
    if (yachtId) fetchData();
  }, [yachtId]);

  async function startShift() {
    if (!email) {
      alert("Crew email required");
      return;
    }

    const { error } = await supabase.from("crew_shift_logs").insert({
      yacht_id: yachtId,
      crew_email: email,
      shift_type: shiftType,
      notes,
      status: "active",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNotes("");
    fetchData();
  }

  async function finishShift(id: string) {
    await supabase
      .from("crew_shift_logs")
      .update({ status: "completed" })
      .eq("id", id);

    fetchData();
  }

  async function completeTask(id: string) {
    await supabase
      .from("crew_tasks")
      .update({ status: "completed" })
      .eq("id", id);

    fetchData();
  }

  const myTasks = email
    ? tasks.filter(
        (task) =>
          !task.assigned_to ||
          task.assigned_to?.toLowerCase() === email.toLowerCase() ||
          task.crew_email?.toLowerCase() === email.toLowerCase()
      )
    : tasks;

  const pending = myTasks.filter((t) => t.status !== "completed");

  return (
    <main className="min-h-screen bg-[#020817] p-4 pb-28 text-white">
      <div className="mx-auto max-w-md">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back
        </a>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 p-7">
          <p className="text-sm text-gray-400">BlueDeck Mobile</p>
          <h1 className="mt-3 text-4xl font-black">Crew App</h1>
          <p className="mt-3 text-gray-400">
            Mobile task board, shift log and quick crew operations.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat title="Tasks" value={myTasks.length} />
          <Stat title="Pending" value={pending.length} />
          <Stat title="Shifts" value={shifts.length} />
        </div>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-bold">Crew Login</h2>

          <div className="mt-4 space-y-3">
            <input
              placeholder="crew email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-white/10 p-4 outline-none"
            />

            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
              className="w-full rounded-2xl bg-white/10 p-4 outline-none"
            >
              <option>Day Shift</option>
              <option>Night Watch</option>
              <option>Guest Service</option>
              <option>Dock Watch</option>
              <option>Cleaning</option>
              <option>Engineering Watch</option>
            </select>

            <textarea
              placeholder="Shift notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-24 w-full rounded-2xl bg-white/10 p-4 outline-none"
            />

            <button
              onClick={startShift}
              className="w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black"
            >
              Start Shift
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-bold">My Tasks</h2>

          <div className="mt-4 space-y-3">
            {myTasks.map((task) => (
              <div
                key={task.id}
                className={`rounded-2xl border p-4 ${
                  task.status === "completed"
                    ? "border-green-500/30 bg-green-500/10"
                    : "border-blue-500/30 bg-blue-500/10"
                }`}
              >
                <h3 className="text-xl font-bold">{task.title}</h3>
                <p className="mt-2 text-sm text-gray-300">
                  {task.description || "No description"}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded-full bg-black/30 px-3 py-1 text-xs">
                    {task.status}
                  </span>

                  {task.status !== "completed" && (
                    <button
                      onClick={() => completeTask(task.id)}
                      className="rounded-xl bg-green-400 px-4 py-2 font-bold text-black"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            ))}

            {myTasks.length === 0 && (
              <div className="rounded-2xl border border-white/10 p-5 text-gray-400">
                No tasks found.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <h2 className="text-2xl font-bold">Shift Logs</h2>

          <div className="mt-4 space-y-3">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <h3 className="font-bold">{shift.crew_email}</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {shift.shift_type} · {shift.status}
                </p>
                {shift.notes && (
                  <p className="mt-2 text-sm text-gray-300">{shift.notes}</p>
                )}

                {shift.status !== "completed" && (
                  <button
                    onClick={() => finishShift(shift.id)}
                    className="mt-3 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"
                  >
                    Finish Shift
                  </button>
                )}
              </div>
            ))}

            {shifts.length === 0 && (
              <div className="rounded-2xl border border-white/10 p-5 text-gray-400">
                No shift logs yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-gray-400">{title}</p>
      <h2 className="mt-2 text-3xl font-black">{value}</h2>
    </div>
  );
}