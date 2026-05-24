"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Anchor,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";

export default function CrewTasksPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState("");

  const stats = useMemo(() => {
    const allItems = checklists.flatMap((list) => list.yacht_checklist_items || []);
    const completed = allItems.filter((item) => item.completed).length;
    const total = allItems.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    return {
      totalLists: checklists.length,
      totalTasks: total,
      completed,
      progress,
    };
  }, [checklists]);

  async function loadTasks(emailOverride?: string) {
    const targetEmail = emailOverride || email;

    if (!targetEmail) {
      alert("Please enter your email.");
      return;
    }

    setLoading(true);

    const { data: crewProfile, error: profileError } = await supabase
      .from("crew_profiles")
      .select("*")
      .eq("email", targetEmail.trim().toLowerCase())
      .single();

    if (profileError || !crewProfile) {
      alert("Crew profile not found.");
      setLoading(false);
      return;
    }

    setProfile(crewProfile);

    const { data: lists, error: listError } = await supabase
      .from("yacht_checklists")
      .select(`
        *,
        yacht_checklist_items (*)
      `)
      .eq("assigned_to", crewProfile.id)
      .order("created_at", { ascending: false });

    if (listError) {
      alert(listError.message);
      setLoading(false);
      return;
    }

    setChecklists(lists || []);
    setActiveChecklist((lists || [])[0] || null);
    setLoading(false);
  }

  async function toggleTask(task: any) {
    setUpdatingTaskId(task.id);

    await supabase
      .from("yacht_checklist_items")
      .update({
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null,
        completed_by: profile?.email || email,
      })
      .eq("id", task.id);

    await loadTasks();
    setUpdatingTaskId("");
  }

  async function uploadTaskPhoto(task: any, file: File, type: "before" | "after") {
    setUploadingPhoto(`${type}-${task.id}`);

    const safeName = file.name.replaceAll(" ", "-").toLowerCase();
    const filePath = `${activeChecklist.yacht_id}/${task.id}/${type}-${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("task-photos")
      .upload(filePath, file);

    if (uploadError) {
      setUploadingPhoto("");
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("task-photos").getPublicUrl(filePath);

    await supabase
      .from("yacht_checklist_items")
      .update({
        [type === "before" ? "before_photo_url" : "after_photo_url"]: data.publicUrl,
      })
      .eq("id", task.id);

    await loadTasks();
    setUploadingPhoto("");
  }

  useEffect(() => {
    async function openLoggedInPortal() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setEmail(user.email);
        await loadTasks(user.email);
      }
    }

    openLoggedInPortal();
  }, []);

  async function completeChecklist(checklist: any) {
    const items = checklist.yacht_checklist_items || [];
    const allCompleted = items.every((item: any) => item.completed);

    if (!allCompleted) {
      alert("Please complete all tasks first.");
      return;
    }

    await supabase
      .from("yacht_checklists")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", checklist.id);

    await loadTasks();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] text-slate-900">
      <section className="border-b border-white/70 bg-white/80 px-6 py-5 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-slate-950 shadow-[0_18px_45px_rgba(8,145,178,0.22)]">
              <Anchor className="h-7 w-7" />
            </div>

            <div>
              <p className="text-sm font-semibold text-cyan-700">BlueDeck Crew Portal</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">My Duties</h1>
            </div>
          </div>

          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
            My Dashboard
          </Link>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[390px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-[34px] border border-slate-200 bg-white/80 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-cyan-700" />
              <div>
                <p className="text-sm text-cyan-700">Secure Access</p>
                <h2 className="text-2xl font-black">Open Crew Portal</h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
              />

              <button
                onClick={() => loadTasks()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-600 px-5 py-4 text-lg font-black text-white transition hover:scale-[1.01] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {loading ? "Loading Portal" : "Open Portal"}
              </button>
            </div>
          </div>

          {profile && (
            <div className="rounded-[34px] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-blue-900/10 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                  <UserRound className="h-8 w-8 text-cyan-700" />
                </div>

                <div>
                  <h2 className="text-2xl font-black">
                    {profile.full_name || "Crew Member"}
                  </h2>
                  <p className="text-sm text-slate-500">{profile.email}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <MiniStat label="Checklists" value={stats.totalLists} />
                <MiniStat label="Progress" value={`${stats.progress}%`} />
                <MiniStat label="Tasks" value={stats.totalTasks} />
                <MiniStat label="Done" value={stats.completed} />
              </div>

              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm text-slate-500">
                  <span>Overall Completion</span>
                  <span>{stats.progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-600 transition-all"
                    style={{ width: `${stats.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {checklists.length > 0 && (
            <div className="rounded-[34px] border border-slate-200 bg-white/80 p-4">
              <p className="px-2 pb-3 text-sm font-semibold text-cyan-700">
                Assigned Checklists
              </p>

              <div className="space-y-3">
                {checklists.map((list) => {
                  const items = list.yacht_checklist_items || [];
                  const done = items.filter((item: any) => item.completed).length;
                  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
                  const active = activeChecklist?.id === list.id;

                  return (
                    <button
                      key={list.id}
                      onClick={() => setActiveChecklist(list)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-cyan-300 bg-cyan-600/10"
                          : "border-slate-200 bg-white/70 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-black">{list.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {list.department} · {list.checklist_type}
                          </p>
                        </div>

                        <ChevronRight className="h-5 w-5 text-slate-500" />
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-600"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <section className="space-y-6">
          <div className="rounded-[40px] border border-slate-200 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="flex items-center gap-2 text-cyan-700">
                  <Sparkles className="h-5 w-5" />
                  Crew Work Center
                </p>

                <h2 className="mt-3 text-5xl font-black tracking-tight">
                  Today’s Assigned Duties
                </h2>

                <p className="mt-4 max-w-2xl text-lg text-slate-500">
                  Complete assigned yacht operations, watchkeeping rounds,
                  safety checks and department duties from one clean crew portal.
                </p>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white/70 p-5 text-center">
                <p className="text-sm text-slate-500">Overall Progress</p>
                <h3 className="mt-2 text-5xl font-black text-cyan-700">
                  {stats.progress}%
                </h3>
              </div>
            </div>
          </div>

          {!profile && (
            <div className="rounded-[34px] border border-slate-200 bg-white/80 p-10 text-center">
              <ShieldCheck className="mx-auto h-14 w-14 text-cyan-700" />
              <h3 className="mt-4 text-3xl font-black">Enter your crew email</h3>
              <p className="mt-3 text-slate-500">
                Your assigned duties will appear after opening your portal.
              </p>
            </div>
          )}

          {profile && !activeChecklist && (
            <div className="rounded-[34px] border border-slate-200 bg-white/80 p-10 text-center">
              <ClipboardCheck className="mx-auto h-14 w-14 text-cyan-700" />
              <h3 className="mt-4 text-3xl font-black">No assigned checklist yet</h3>
              <p className="mt-3 text-slate-500">
                Your captain has not assigned any duty checklist to you yet.
              </p>
            </div>
          )}

          {activeChecklist && (
            <div className="rounded-[40px] border border-slate-200 bg-white/80 p-8">
              <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-center">
                <div>
                  <p className="text-cyan-700">
                    {activeChecklist.department} · {activeChecklist.checklist_type}
                  </p>
                  <h2 className="mt-2 text-4xl font-black">
                    {activeChecklist.title}
                  </h2>
                  {activeChecklist.captain_note && (
                    <p className="mt-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-100">
                      Captain note: {activeChecklist.captain_note}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => completeChecklist(activeChecklist)}
                  className="rounded-2xl bg-green-400 px-6 py-4 font-black text-white"
                >
                  Complete Checklist
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {(activeChecklist.yacht_checklist_items || []).map((task: any) => (
                  <div
                    key={task.id}
                    className={`rounded-3xl border p-5 transition ${
                      task.completed
                        ? "border-green-400/30 bg-green-400/10"
                        : "border-slate-200 bg-white/70 hover:border-cyan-300/40"
                    }`}
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className="flex w-full items-center gap-4 text-left"
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                          task.completed ? "bg-green-400 text-white" : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {updatingTaskId === task.id ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6" />
                        )}
                      </div>

                      <div className="flex-1">
                        <p
                          className={`text-lg font-semibold ${
                            task.completed ? "text-slate-500 line-through" : "text-slate-950"
                          }`}
                        >
                          {task.task_text}
                        </p>

                        {task.completed_at && (
                          <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            Completed
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <PhotoBox
                        label="Before photo"
                        url={task.before_photo_url}
                        uploading={uploadingPhoto === `before-${task.id}`}
                        onUpload={(file) => uploadTaskPhoto(task, file, "before")}
                      />
                      <PhotoBox
                        label="After photo"
                        url={task.after_photo_url}
                        uploading={uploadingPhoto === `after-${task.id}`}
                        onUpload={(file) => uploadTaskPhoto(task, file, "after")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PhotoBox({
  label,
  url,
  uploading,
  onUpload,
}: {
  label: string;
  url?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <p className="font-semibold text-gray-200">{label}</p>
      {url && (
        <img
          src={url}
          alt={label}
          className="mt-3 h-40 w-full rounded-2xl object-cover"
        />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
        }}
        className="mt-3 text-sm"
      />
      {uploading && <p className="mt-2 text-sm text-cyan-700">Uploading...</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <h3 className="mt-1 text-2xl font-black">{value}</h3>
    </div>
  );
}
