"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function CrewPortalPage() {
  const [userEmail, setUserEmail] = useState("");
  const [crewProfiles, setCrewProfiles] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState("");

  async function loadCrewDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      window.location.href = "/login";
      return;
    }

    setUserEmail(user.email);

    const { data: crewData, error: crewError } = await supabase
      .from("crew_members")
      .select("*")
      .eq("invite_email", user.email);

    if (crewError) {
      alert(crewError.message);
      setLoading(false);
      return;
    }

    setCrewProfiles(crewData || []);

    if (!crewData || crewData.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const crewIds = crewData.map((member) => member.id);

    const { data: taskData, error: taskError } = await supabase
      .from("crew_tasks")
      .select("*")
      .in("assigned_to", crewIds)
      .order("created_at", { ascending: false });

    if (taskError) {
      alert(taskError.message);
      setLoading(false);
      return;
    }

    setTasks(taskData || []);
    setLoading(false);
  }

  async function updateTask(taskId: string, updates: any) {
    const { error } = await supabase
      .from("crew_tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    loadCrewDashboard();
  }

  async function uploadPhoto(
    taskId: string,
    yachtId: string,
    file: File,
    type: "before" | "after"
  ) {
    setUploading(`${type}-${taskId}`);

    const safeName = file.name.replaceAll(" ", "-").toLowerCase();
    const filePath = `${yachtId}/${taskId}/${type}-${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("task-photos")
      .upload(filePath, file);

    if (uploadError) {
      setUploading("");
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("task-photos")
      .getPublicUrl(filePath);

    if (type === "before") {
      await updateTask(taskId, { before_photo_url: data.publicUrl });
    } else {
      await updateTask(taskId, { after_photo_url: data.publicUrl });
    }

    setUploading("");
  }

  useEffect(() => {
    loadCrewDashboard();
  }, []);

  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const progressCount = tasks.filter(
    (task) => task.status === "in_progress"
  ).length;
  const completedCount = tasks.filter(
    (task) => task.status === "completed"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#081120] p-10 text-white">
        Loading crew portal...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#081120] p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <a href="/dashboard" className="text-blue-300">
          ← Back to dashboard
        </a>

        <div className="mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">Crew Portal</p>

          <h1 className="mt-2 text-5xl font-bold">My Tasks</h1>

          <p className="mt-4 text-gray-400">
            Logged in as: {userEmail}
          </p>
        </div>

        {crewProfiles.length === 0 && (
          <div className="mt-8 rounded-3xl bg-white/5 p-8 text-gray-400">
            No yacht invitation found for this account yet.
          </div>
        )}

        {crewProfiles.length > 0 && (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl bg-white/5 p-6">
                <p className="text-gray-400">Pending</p>
                <h2 className="mt-4 text-5xl font-bold">{pendingCount}</h2>
              </div>

              <div className="rounded-3xl bg-white/5 p-6">
                <p className="text-gray-400">In Progress</p>
                <h2 className="mt-4 text-5xl font-bold">{progressCount}</h2>
              </div>

              <div className="rounded-3xl bg-white/5 p-6">
                <p className="text-gray-400">Completed</p>
                <h2 className="mt-4 text-5xl font-bold">{completedCount}</h2>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-8"
                >
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-bold">{task.title}</h2>

                        <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-300">
                          {task.category}
                        </span>

                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
                          {task.priority}
                        </span>

                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
                          {task.status}
                        </span>
                      </div>

                      <p className="mt-4 text-gray-400">
                        {task.description}
                      </p>

                      <div className="mt-5 grid gap-3 text-sm text-gray-400 md:grid-cols-3">
                        <p>Assigned: {task.assigned_to_name || "You"}</p>
                        <p>Role: {task.assigned_role || "Crew"}</p>
                        <p>Due: {task.due_date || "No date"}</p>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <textarea
                          defaultValue={task.before_note || ""}
                          onBlur={(e) =>
                            updateTask(task.id, {
                              before_note: e.target.value,
                            })
                          }
                          placeholder="Before note"
                          className="h-24 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 outline-none"
                        />

                        <textarea
                          defaultValue={task.after_note || ""}
                          onBlur={(e) =>
                            updateTask(task.id, {
                              after_note: e.target.value,
                            })
                          }
                          placeholder="After note"
                          className="h-24 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 outline-none"
                        />
                      </div>

                      <div className="mt-6 grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                          <p className="font-semibold">Before Photo</p>

                          {task.before_photo_url && (
                            <img
                              src={task.before_photo_url}
                              alt="Before"
                              className="mt-4 h-48 w-full rounded-2xl object-cover"
                            />
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                uploadPhoto(
                                  task.id,
                                  task.yacht_id,
                                  file,
                                  "before"
                                );
                              }
                            }}
                            className="mt-4"
                          />

                          {uploading === `before-${task.id}` && (
                            <p className="mt-2 text-sm text-blue-300">
                              Uploading...
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                          <p className="font-semibold">After Photo</p>

                          {task.after_photo_url && (
                            <img
                              src={task.after_photo_url}
                              alt="After"
                              className="mt-4 h-48 w-full rounded-2xl object-cover"
                            />
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                uploadPhoto(
                                  task.id,
                                  task.yacht_id,
                                  file,
                                  "after"
                                );
                              }
                            }}
                            className="mt-4"
                          />

                          {uploading === `after-${task.id}` && (
                            <p className="mt-2 text-sm text-blue-300">
                              Uploading...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[180px] flex-col gap-3">
                      <button
                        onClick={() =>
                          updateTask(task.id, { status: "in_progress" })
                        }
                        className="rounded-2xl bg-yellow-500/20 px-5 py-4 text-yellow-300"
                      >
                        Start Task
                      </button>

                      <button
                        onClick={() =>
                          updateTask(task.id, { status: "completed" })
                        }
                        className="rounded-2xl bg-green-500/20 px-5 py-4 text-green-300"
                      >
                        Mark Completed
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="rounded-3xl bg-white/5 p-8 text-gray-400">
                  No assigned tasks yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
