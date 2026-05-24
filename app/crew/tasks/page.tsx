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
  Ship,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import {
  markInvitationAccepted,
  saveYachtMembership,
} from "../../lib/yachtMemberships";

export default function CrewTasksPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState("");

  const stats = useMemo(() => {
    const allItems = checklists.flatMap((list) => list.yacht_checklist_items || []);
    const completed = allItems.filter((item) => item.completed).length;
    const total = allItems.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    return {
      totalLists: checklists.length,
      pendingInvitations: invitations.length,
      totalTasks: total,
      completed,
      progress,
    };
  }, [checklists, invitations]);

  async function loadTasks(emailOverride?: string) {
    const targetEmail = (emailOverride || email).trim().toLowerCase();

    if (!targetEmail) {
      alert("Please enter your email.");
      return;
    }

    setEmail(targetEmail);
    setLoading(true);

    const { data: crewProfile, error: profileError } = await supabase
      .from("crew_profiles")
      .select("*")
      .eq("email", targetEmail)
      .single();

    if (profileError || !crewProfile) {
      alert("Crew profile not found.");
      setProfile(null);
      setInvitations([]);
      setChecklists([]);
      setActiveChecklist(null);
      setLoading(false);
      return;
    }

    setProfile(crewProfile);

    const [emailInvites, profileInvites] = await Promise.all([
      supabase
        .from("crew_invitations")
        .select("*")
        .eq("status", "pending")
        .eq("invited_email", targetEmail)
        .order("created_at", { ascending: false }),
      supabase
        .from("crew_invitations")
        .select("*")
        .eq("status", "pending")
        .eq("crew_profile_id", crewProfile.id)
        .order("created_at", { ascending: false }),
    ]);

    if (emailInvites.error || profileInvites.error) {
      alert(emailInvites.error?.message || profileInvites.error?.message);
      setLoading(false);
      return;
    }

    const mergedInvites = [
      ...(emailInvites.data || []),
      ...(profileInvites.data || []),
    ].filter(
      (invite, index, items) =>
        items.findIndex((candidate) => candidate.id === invite.id) === index
    );

    setInvitations(mergedInvites);

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

  async function acceptInvitation(invitation: any) {
    if (!profile?.id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      alert("Please login first, then open My YachtOS again.");
      window.location.href = "/login";
      return;
    }

    setAcceptingInviteId(invitation.id);
    const { error: memberError } = await saveYachtMembership(supabase, {
      yacht_id: invitation.yacht_id,
      crew_profile_id: profile.id,
      invited_email: profile.email || email,
      position: invitation.position,
      department: invitation.department,
      status: "active",
    });

    if (memberError) {
      alert(memberError.message);
      setAcceptingInviteId("");
      return;
    }

    const { error: inviteError } = await markInvitationAccepted(
      supabase,
      invitation.id,
      profile.id
    );

    if (inviteError) {
      alert(inviteError.message);
      setAcceptingInviteId("");
      return;
    }

    await loadTasks(profile.email || email);
    setAcceptingInviteId("");
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
              <h1 className="text-2xl font-black tracking-tight text-slate-950">My YachtOS</h1>
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
                <MiniStat label="Invites" value={stats.pendingInvitations} />
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
                  My YachtOS Work Center
                </h2>

                <p className="mt-4 max-w-2xl text-lg text-slate-500">
                  Accept captain invitations, complete yacht operations,
                  watchkeeping rounds, safety checks and department duties from
                  one clean crew portal.
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

          {profile && !activeChecklist && invitations.length === 0 && (
            <div className="rounded-[34px] border border-slate-200 bg-white/80 p-10 text-center">
              <ClipboardCheck className="mx-auto h-14 w-14 text-cyan-700" />
              <h3 className="mt-4 text-3xl font-black">No assigned checklist yet</h3>
              <p className="mt-3 text-slate-500">
                Your captain has not assigned any duty checklist to you yet.
              </p>
            </div>
          )}

          {profile && invitations.length > 0 && (
            <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white/85 shadow-2xl shadow-cyan-950/10">
              <div className="h-1.5 bg-[linear-gradient(90deg,#08111f,#22d3ee,#d8b45f,#ef776f)]" />
              <div className="p-7">
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-[0_18px_40px_rgba(8,145,178,0.22)]">
                      <UserPlus className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cyan-700">
                        Captain Invitation
                      </p>
                      <h3 className="text-3xl font-black text-slate-950">
                        Pending yacht invitations
                      </h3>
                    </div>
                  </div>
                  <p className="max-w-md text-sm leading-6 text-slate-500">
                    Accept an invitation here. After acceptance, the captain can
                    assign you yacht checklists and contracts inside BlueDeck.
                  </p>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f3fbfc_100%)] p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
                            <Ship className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-slate-950">
                              YachtOS Invitation
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              {invitation.position || "Crew"} ·{" "}
                              {invitation.department || "Yacht Operations"}
                            </p>
                            {invitation.created_at && (
                              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                                Sent {new Date(invitation.created_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => acceptInvitation(invitation)}
                        disabled={acceptingInviteId === invitation.id}
                        className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white transition hover:bg-cyan-700 disabled:opacity-60"
                      >
                        {acceptingInviteId === invitation.id && (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        )}
                        {acceptingInviteId === invitation.id
                          ? "Accepting..."
                          : "Accept Invitation"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
