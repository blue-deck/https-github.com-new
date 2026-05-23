"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function TasksPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [tasks, setTasks] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [priority, setPriority] = useState("normal");

  async function fetchTasks() {
    const { data } = await supabase
      .from("crew_tasks")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setTasks(data || []);
  }

  async function createTask() {
    if (!title) {
      alert("Task title required");
      return;
    }

    const { error } = await supabase.from("crew_tasks").insert({
      yacht_id: yachtId,
      assigned_to_email: assignedEmail,
      title,
      description,
      priority,
      status: "pending",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setAssignedEmail("");
    setPriority("normal");

    fetchTasks();
  }

  async function completeTask(id: string) {
    await supabase
      .from("crew_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    fetchTasks();
  }

  async function deleteTask(id: string) {
    await supabase.from("crew_tasks").delete().eq("id", id);

    fetchTasks();
  }

  useEffect(() => {
    if (yachtId) fetchTasks();
  }, [yachtId]);

  return (
    <main className="min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Crew Operations</p>

          <h1 className="mt-3 text-5xl font-bold">
            Crew Tasks
          </h1>

          <p className="mt-4 text-gray-400">
            Assign tasks to crew members and track completion.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">
              Create Task
            </h2>

            <div className="mt-6 space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="w-full rounded-2xl bg-white/5 p-4 outline-none"
              />

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Description"
                className="h-40 w-full rounded-2xl bg-white/5 p-4 outline-none"
              />

              <input
                value={assignedEmail}
                onChange={(e) =>
                  setAssignedEmail(e.target.value)
                }
                placeholder="Crew email"
                className="w-full rounded-2xl bg-white/5 p-4 outline-none"
              />

              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value)
                }
                className="w-full rounded-2xl bg-white/5 p-4 outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>

              <button
                onClick={createTask}
                className="w-full rounded-2xl bg-blue-400 p-4 font-bold text-black"
              >
                Create Task
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">
              Active Tasks
            </h2>

            <div className="mt-6 space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold">
                        {task.title}
                      </h3>

                      <p className="mt-2 text-gray-400">
                        {task.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        <div className="rounded-full bg-white/10 px-3 py-1">
                          {task.priority}
                        </div>

                        <div className="rounded-full bg-white/10 px-3 py-1">
                          {task.status}
                        </div>

                        <div className="rounded-full bg-white/10 px-3 py-1">
                          {task.assigned_to_email}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {task.status !== "completed" && (
                        <button
                          onClick={() =>
                            completeTask(task.id)
                          }
                          className="rounded-xl bg-green-400 px-4 py-2 font-bold text-black"
                        >
                          Complete
                        </button>
                      )}

                      <button
                        onClick={() =>
                          deleteTask(task.id)
                        }
                        className="rounded-xl border border-red-500/40 px-4 py-2 text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="rounded-2xl border border-white/10 p-6 text-gray-400">
                  No tasks created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}