"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { createSafeStoragePath } from "../../lib/storage";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
} from "lucide-react";
import { BlueDeckMark } from "../../components/BlueDeckLogo";
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
  const [completingChecklistId, setCompletingChecklistId] = useState("");

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
      setLoading(false);
      return;
    }

    setEmail(targetEmail);
    setLoading(true);

    const { data: crewProfile, error: profileError } = await supabase
      .from("crew_profiles")
      .select("*")
      .eq("email", targetEmail)
      .limit(1)
      .maybeSingle();

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

    let nextLists = lists || [];
    const createdRecurring = await ensureRecurringChecklistInstances(nextLists, crewProfile.id);

    if (createdRecurring > 0) {
      const { data: refreshedLists, error: refreshError } = await supabase
        .from("yacht_checklists")
        .select(`
          *,
          yacht_checklist_items (*)
        `)
        .eq("assigned_to", crewProfile.id)
        .order("created_at", { ascending: false });

      if (!refreshError) nextLists = refreshedLists || nextLists;
    }

    setChecklists(nextLists);
    setActiveChecklist((current: any) =>
      nextLists.find((list) => list.id === current?.id) || nextLists[0] || null
    );
    setLoading(false);
  }

  async function ensureRecurringChecklistInstances(lists: any[], crewProfileId: string) {
    const sourceBySignature = new Map<string, any>();
    const currentPeriodSignatures = new Set<string>();
    const now = new Date();

    lists.forEach((list) => {
      const frequency = getChecklistFrequency(list);
      if (!isRecurringFrequency(frequency)) return;

      const signature = getRecurringSignature(list, frequency);
      if (!signature) return;

      if (!sourceBySignature.has(signature)) {
        sourceBySignature.set(signature, list);
      }

      if (getPeriodKey(list.created_at, frequency) === getPeriodKey(now.toISOString(), frequency)) {
        currentPeriodSignatures.add(signature);
      }
    });

    let created = 0;

    for (const [signature, source] of sourceBySignature.entries()) {
      const frequency = getChecklistFrequency(source);
      if (currentPeriodSignatures.has(signature)) continue;

      const checklistPayload = {
        yacht_id: source.yacht_id,
        title: source.title,
        department: source.department,
        checklist_type: source.checklist_type,
        frequency,
        due_date: now.toISOString().slice(0, 10),
        captain_note: getCaptainNote(source) || null,
        assigned_to: crewProfileId,
        status: "open",
        items: {
          ...(typeof source.items === "object" && source.items ? source.items : {}),
          frequency,
          captain_note: getCaptainNote(source) || null,
          recurring_from: source.id,
          recurring_period: getPeriodKey(now.toISOString(), frequency),
        },
      };

      const { data: checklist, error } = await insertRecurringChecklist(checklistPayload);

      if (error || !checklist?.id) continue;

      const sourceTasks = (source.yacht_checklist_items || [])
        .map((task: any) => (task.task_text || "").trim())
        .filter(Boolean);

      if (sourceTasks.length) {
        await supabase.from("yacht_checklist_items").insert(
          sourceTasks.map((task: string) => ({
            checklist_id: checklist.id,
            task_text: task,
            completed: false,
          }))
        );
      }

      created += 1;
    }

    return created;
  }

  async function insertRecurringChecklist(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["captain_note"]),
      omitKeys(payload, ["frequency"]),
      omitKeys(payload, ["frequency", "captain_note"]),
      omitKeys(payload, ["items"]),
      omitKeys(payload, ["items", "captain_note"]),
      omitKeys(payload, ["items", "frequency"]),
      omitKeys(payload, ["items", "frequency", "captain_note"]),
      omitKeys(payload, ["items", "frequency", "captain_note", "due_date"]),
      omitKeys(payload, ["items", "frequency", "captain_note", "due_date", "status"]),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("yacht_checklists")
        .insert(variant)
        .select()
        .single();

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
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

    const { error } = await updateTaskWithFallback(task.id, {
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
      completed_by: profile?.email || email,
    });

    if (error) {
      alert(error.message);
    } else {
      await loadTasks();
    }

    setUpdatingTaskId("");
  }

  async function uploadTaskPhoto(task: any, file: File, type: "before" | "after") {
    setUploadingPhoto(`${type}-${task.id}`);

    const filePath = createSafeStoragePath(`${activeChecklist.yacht_id}/${task.id}`, file, type);

    const upload = await uploadTaskFile(filePath, file);

    if (upload.error || !upload.publicUrl) {
      setUploadingPhoto("");
      alert(upload.error || "Photo could not be uploaded.");
      return;
    }

    const note = {
      ...parseTaskNote(task),
      [`${type}_photo_url`]: upload.publicUrl,
    };

    const { error: updateError } = await updateTaskPhotoWithFallback(
      task.id,
      type,
      upload.publicUrl,
      note
    );

    if (updateError) {
      setUploadingPhoto("");
      alert(updateError.message);
      return;
    }

    await loadTasks();
    setUploadingPhoto("");
  }

  async function uploadTaskFile(filePath: string, file: File) {
    const buckets = ["task-photos", "crew-portfolio"];
    let lastError = "";

    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, file);

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return { publicUrl: data.publicUrl, error: "" };
      }

      lastError = error.message;
      if (error.message !== "Bucket not found") break;
    }

    return {
      publicUrl: "",
      error:
        lastError === "Bucket not found"
          ? "Photo storage is not ready yet. Please create the task-photos bucket in Supabase Storage."
          : lastError,
    };
  }

  async function updateTaskWithFallback(taskId: string, payload: Record<string, unknown>) {
    const variants = [
      payload,
      omitKeys(payload, ["completed_at", "completed_by"]),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("yacht_checklist_items")
        .update(variant)
        .eq("id", taskId);

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  async function updateTaskPhotoWithFallback(
    taskId: string,
    type: "before" | "after",
    publicUrl: string,
    note: Record<string, unknown>
  ) {
    const variants = [
      { note: JSON.stringify(note) },
      { [`${type}_photo_url`]: publicUrl },
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("yacht_checklist_items")
        .update(variant)
        .eq("id", taskId);

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  useEffect(() => {
    async function openLoggedInPortal() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        window.location.replace("/login");
        return;
      }

      setEmail(user.email);
      await loadTasks(user.email);
    }

    openLoggedInPortal();
  }, []);

  async function completeChecklist(checklist: any) {
    if (checklist?.status === "completed") return;

    const items = checklist.yacht_checklist_items || [];
    const allCompleted = items.length > 0 && items.every((item: any) => item.completed);

    if (!allCompleted) {
      alert("Please complete all tasks first.");
      return;
    }

    setCompletingChecklistId(checklist.id);

    const { error } = await updateChecklistWithFallback(checklist.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      setCompletingChecklistId("");
      return;
    }

    await loadTasks();
    setCompletingChecklistId("");
  }

  async function updateChecklistWithFallback(
    checklistId: string,
    payload: Record<string, unknown>
  ) {
    const variants = [payload, omitKeys(payload, ["completed_at"])];
    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("yacht_checklists")
        .update(variant)
        .eq("id", checklistId)
        .select("id, status, completed_at")
        .maybeSingle();

      if (!response.error && response.data) return response;
      if (!response.error) {
        return {
          ...response,
          error: new Error(
            "Checklist could not be updated. Please refresh the page and try again."
          ),
        };
      }

      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  return (
    <main className="bd-ocean-shell min-h-screen min-w-0 overflow-x-hidden text-slate-900">
      <div className="bd-ocean-content bd-crew-task-content mx-auto grid w-full min-w-0 max-w-7xl gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-6">
          {checklists.length > 0 && (
            <div className="bd-glass-card rounded-[34px] p-4">
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
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 data-i18n-ignore className="break-words font-black">{list.title}</h3>
                          <p data-i18n-ignore className="mt-1 text-xs text-slate-500">
                            {list.department} · {list.checklist_type}
                          </p>
                        </div>

                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
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

        <section className="min-w-0 space-y-6">
          <div className="bd-glass-card-strong rounded-[40px] p-5 sm:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-cyan-700">
                  <Sparkles className="h-5 w-5" />
                  Crew Work Center
                </p>

                <h2 className="bd-serif mt-3 break-words text-4xl font-normal tracking-tight text-[#071f3c] sm:text-5xl">
                  My YachtOS Work Center
                </h2>

                <p className="mt-4 max-w-2xl text-lg text-slate-500">
                  Accept captain invitations, complete yacht operations,
                  watchkeeping rounds, safety checks and department duties from
                  one clean crew portal.
                </p>
              </div>

              <div className="w-full rounded-[30px] border border-slate-200 bg-white/70 p-5 text-center sm:w-auto">
                <p className="text-sm text-slate-500">Overall Progress</p>
                <h3 className="mt-2 text-5xl font-black text-cyan-700">
                  {stats.progress}%
                </h3>
              </div>
            </div>
          </div>

          {!profile && !loading && (
            <div className="bd-glass-card rounded-[34px] p-10 text-center">
              <ShieldCheck className="mx-auto h-14 w-14 text-cyan-700" />
              <h3 className="mt-4 text-3xl font-black">Crew portal unavailable</h3>
              <p className="mt-3 text-slate-500">
                Your crew profile is not ready for this portal yet. Ask your captain to send your yacht invitation.
              </p>
            </div>
          )}

          {profile && !activeChecklist && invitations.length === 0 && (
            <div className="bd-glass-card rounded-[34px] p-10 text-center">
              <ClipboardCheck className="mx-auto h-14 w-14 text-cyan-700" />
              <h3 className="mt-4 text-3xl font-black">No assigned checklist yet</h3>
              <p className="mt-3 text-slate-500">
                Your captain has not assigned any duty checklist to you yet.
              </p>
            </div>
          )}

          {profile && invitations.length > 0 && (
            <div className="bd-glass-card-strong overflow-hidden rounded-[34px]">
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
                          <BlueDeckMark className="h-12 w-16 shrink-0 rounded-none border-0 bg-transparent shadow-none" imageClassName="object-contain p-0" />
                          <div>
                            <h4 className="text-xl font-black text-slate-950">
                              YachtOS Invitation
                            </h4>
                            <p data-i18n-ignore className="mt-1 text-sm text-slate-500">
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
            <div className="bd-glass-card-strong min-w-0 rounded-[40px] p-5 sm:p-8">
              <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-center">
                <div className="min-w-0">
                  <p data-i18n-ignore className="text-cyan-700">
                    {activeChecklist.department} · {activeChecklist.checklist_type}
                  </p>
                  <h2 data-i18n-ignore className="mt-2 break-words text-3xl font-black sm:text-4xl">
                    {activeChecklist.title}
                  </h2>
                  {getCaptainNote(activeChecklist) && (
                    <p className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-50 p-4 text-slate-700">
                      Captain note: <span data-i18n-ignore>{getCaptainNote(activeChecklist)}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => completeChecklist(activeChecklist)}
                  disabled={
                    activeChecklist.status === "completed" ||
                    completingChecklistId === activeChecklist.id
                  }
                  className="flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-green-500 px-6 py-4 font-black text-white shadow-lg shadow-green-500/20 transition hover:bg-green-600 disabled:cursor-default disabled:bg-emerald-700 disabled:shadow-none"
                >
                  {completingChecklistId === activeChecklist.id ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Completing...
                    </>
                  ) : activeChecklist.status === "completed" ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Checklist Completed
                    </>
                  ) : (
                    "Complete Checklist"
                  )}
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {(activeChecklist.yacht_checklist_items || []).map((task: any) => (
                  <div
                    key={task.id}
                    className={`min-w-0 overflow-hidden rounded-3xl border p-5 transition ${
                      task.completed
                        ? "border-green-400/30 bg-green-400/10"
                        : "border-slate-200 bg-white/70 hover:border-cyan-300/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      disabled={
                        activeChecklist.status === "completed" ||
                        updatingTaskId === task.id
                      }
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
                          data-i18n-ignore
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

                    <div className="bd-crew-proof-grid mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <PhotoBox
                        label="Before photo"
                        url={getTaskPhoto(task, "before")}
                        uploading={uploadingPhoto === `before-${task.id}`}
                        onUpload={(file) => uploadTaskPhoto(task, file, "before")}
                      />
                      <PhotoBox
                        label="After photo"
                        url={getTaskPhoto(task, "after")}
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
    <div className="bd-crew-proof-card min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 sm:p-4">
      <p className="font-semibold text-slate-700">{label}</p>
      {url && (
        <div className="mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
          <img
            src={url}
            alt={label}
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <label className="mt-3 flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800">
        {uploading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Upload className="h-4 w-4 shrink-0" />}
        <span className="truncate">{uploading ? "Uploading..." : url ? "Replace photo" : "Add photo"}</span>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = "";
          }}
          className="sr-only"
        />
      </label>
    </div>
  );
}

function getCaptainNote(checklist: any) {
  return checklist?.captain_note || checklist?.items?.captain_note || "";
}

function getChecklistFrequency(checklist: any) {
  return checklist?.frequency || checklist?.items?.frequency || "";
}

function isRecurringFrequency(frequency?: string) {
  return ["daily", "weekly", "monthly"].includes((frequency || "").toLowerCase());
}

function getRecurringSignature(checklist: any, frequency: string) {
  if (!checklist?.assigned_to || !checklist?.title) return "";
  return [
    checklist.assigned_to,
    checklist.yacht_id,
    checklist.title,
    checklist.department,
    checklist.checklist_type,
    frequency,
  ].join("|").toLowerCase();
}

function getPeriodKey(value: string, frequency: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const normalized = (frequency || "").toLowerCase();

  if (normalized === "daily") return `${year}-${month}-${day}`;
  if (normalized === "monthly") return `${year}-${month}`;

  const firstDay = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + firstDay.getDay()) / 7);
  return `${year}-W${`${week}`.padStart(2, "0")}`;
}

function parseTaskNote(task: any) {
  if (!task?.note) return {};
  if (typeof task.note === "object") return task.note;

  try {
    return JSON.parse(task.note);
  } catch {
    return {};
  }
}

function getTaskPhoto(task: any, type: "before" | "after") {
  const note = parseTaskNote(task);
  return (
    task?.[`${type}_photo_url`] ||
    note?.[`${type}_photo_url`] ||
    note?.photos?.[type] ||
    ""
  );
}

function omitKeys<T extends Record<string, unknown>>(value: T, keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key))
  );
}

function isSchemaCacheError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return message.toLowerCase().includes("schema cache");
}
