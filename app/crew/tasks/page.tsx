"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { signChecklistTaskPhotoUrls } from "../../lib/privateStorageUrls";
import { createSafeStoragePath } from "../../lib/storage";
import { resolveSupabaseUrl } from "../../lib/supabaseConfig";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  History,
  ListChecks,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BlueDeckMark } from "../../components/BlueDeckLogo";
import {
  downloadChecklistPdfDocument,
  downloadYachtLogPdfDocument,
  type ChecklistPdfRecord,
} from "../../lib/operationsPdf";

const configuredSupabaseUrl = resolveSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export default function CrewTasksPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationHistory, setInvitationHistory] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [yachts, setYachts] = useState<Record<string, any>>({});
  const [activeChecklist, setActiveChecklist] = useState<any>(null);
  const [portalView, setPortalView] = useState<"home" | "checklists" | "contracts" | "log">("home");
  const [checklistView, setChecklistView] = useState<"open" | "completed" | "archive">("open");
  const [loading, setLoading] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState("");
  const [completingChecklistId, setCompletingChecklistId] = useState("");
  const [pdfAction, setPdfAction] = useState("");
  const [photoPreview, setPhotoPreview] = useState<{ label: string; url: string } | null>(null);

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

  const checklistGroups = useMemo(() => {
    const now = Date.now();
    const archiveCutoff = now - 6 * 30 * 24 * 60 * 60 * 1000;
    const activeCompletedCutoff = now - 24 * 60 * 60 * 1000;
    const open: any[] = [];
    const completed: any[] = [];
    const archive: any[] = [];

    checklists.forEach((checklist) => {
      if (checklist.status !== "completed") {
        open.push(checklist);
        return;
      }

      const completedTime = Date.parse(checklist.completed_at || checklist.updated_at || "");
      if (!Number.isNaN(completedTime) && completedTime >= activeCompletedCutoff) {
        completed.push(checklist);
      } else if (Number.isNaN(completedTime) || completedTime >= archiveCutoff) {
        archive.push(checklist);
      }
    });

    return { open, completed, archive };
  }, [checklists]);

  const yachtLog = useMemo(() => {
    const events = [
      ...invitationHistory.map((invite) => ({
        id: `invite-${invite.id}`,
        date: invite.accepted_at || invite.created_at,
        title: invite.status === "accepted" ? "Yacht invitation accepted" : "Yacht invitation received",
        detail: `${yachts[invite.yacht_id]?.name || "BlueDeck yacht"} · ${invite.position || "Crew"}`,
        type: "Invitation",
      })),
      ...memberships.map((membership) => ({
        id: `membership-${membership.id}`,
        date: membership.created_at,
        title: "Crew access activated",
        detail: `${yachts[membership.yacht_id]?.name || "BlueDeck yacht"} · ${membership.position || "Crew"}`,
        type: "My Deck",
      })),
      ...contracts.map((contract) => ({
        id: `contract-${contract.id}`,
        date: contract.signed_at || contract.sent_at || contract.created_at,
        title: contract.status === "signed" ? "Contract signed" : "Contract received",
        detail: yachts[contract.yacht_id]?.name || "Seafarer employment contract",
        type: "Contract",
      })),
      ...checklists.map((checklist) => ({
        id: `checklist-${checklist.id}`,
        date: checklist.completed_at || checklist.created_at,
        title: checklist.status === "completed" ? "Checklist completed" : "Checklist assigned",
        detail: checklist.title,
        type: "Checklist",
      })),
    ];

    return events
      .filter((event) => event.date)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [checklists, contracts, invitationHistory, memberships, yachts]);

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

    const [emailInvites, profileInvites, allProfileInvites, membershipResponse, contractResponse] = await Promise.all([
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
      supabase
        .from("crew_invitations")
        .select("*")
        .eq("crew_profile_id", crewProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("yacht_crew_memberships")
        .select("*")
        .eq("crew_profile_id", crewProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("yacht_contracts")
        .select("*")
        .eq("crew_profile_id", crewProfile.id)
        .order("sent_at", { ascending: false }),
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
    setInvitationHistory(allProfileInvites.data || []);
    setMemberships(membershipResponse.data || []);
    setContracts(contractResponse.data || []);

    const yachtIds = Array.from(new Set([
      ...(allProfileInvites.data || []).map((item: any) => item.yacht_id),
      ...(membershipResponse.data || []).map((item: any) => item.yacht_id),
      ...(contractResponse.data || []).map((item: any) => item.yacht_id),
    ].filter(Boolean)));

    let operatorByYacht: Record<string, string> = {};
    if (yachtIds.length) {
      const { data: yachtRows } = await supabase
        .from("yachts")
        .select("id, name, owner_id")
        .in("id", yachtIds);
      setYachts(Object.fromEntries((yachtRows || []).map((yacht: any) => [yacht.id, yacht])));

      const ownerIds = Array.from(new Set((yachtRows || []).map((yacht: any) => yacht.owner_id).filter(Boolean)));
      if (ownerIds.length) {
        const { data: operatorRows } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", ownerIds);
        const operators = Object.fromEntries((operatorRows || []).map((operator: any) => [operator.id, operator]));
        operatorByYacht = Object.fromEntries((yachtRows || []).map((yacht: any) => {
          const operator = operators[yacht.owner_id];
          const role = operator?.role ? `${operator.role.charAt(0).toUpperCase()}${operator.role.slice(1)}` : "Captain";
          return [yacht.id, `${role}: ${operator?.full_name || operator?.email || "BlueDeck yacht representative"}`];
        }));
      }
    } else {
      setYachts({});
    }

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

    const nextLists = await signChecklistTaskPhotoUrls(
      supabase,
      (lists || []).map((list: any) => ({
        ...list,
        assigned_by_name:
          operatorByYacht[list.yacht_id] || getChecklistSender(list),
      })),
      configuredSupabaseUrl,
      { preserveRawReferences: true },
    );

    setChecklists(nextLists);
    setActiveChecklist((current: any) =>
      nextLists.find((list) => list.id === current?.id) || null
    );
    setLoading(false);
  }

  async function acceptInvitation(invitation: any) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Please login first, then open My YACHT-OS again.");
      window.location.href = "/login";
      return;
    }

    if (typeof invitation?.token !== "string" || !invitation.token) {
      alert("This invitation link is incomplete. Ask the sender to create a new invitation.");
      return;
    }

    setAcceptingInviteId(invitation.id);
    try {
      const response = await fetch(
        `/api/crew-invitations/${encodeURIComponent(invitation.token)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const payload: unknown = await response.json();
      const error =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>).error
          : null;

      if (!response.ok) {
        alert(
          typeof error === "string"
            ? error
            : "Invitation could not be accepted.",
        );
        return;
      }

      await loadTasks(profile.email || email);
    } catch {
      alert("Invitation could not be accepted.");
    } finally {
      setAcceptingInviteId("");
    }
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
      if (upload.bucket && upload.path) {
        await supabase.storage.from(upload.bucket).remove([upload.path]);
      }
      setUploadingPhoto("");
      alert(updateError.message);
      return;
    }

    await loadTasks();
    setUploadingPhoto("");
  }

  async function uploadTaskFile(filePath: string, file: File) {
    const bucket = "task-photos";
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (!error) {
      return {
        publicUrl: filePath,
        bucket,
        path: filePath,
        error: "",
      };
    }

    return {
      publicUrl: "",
      bucket: "",
      path: "",
      error: error.message,
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

  function canEditChecklist(checklist: any) {
    if (checklist?.status !== "completed") return true;
    const completedTime = Date.parse(checklist.completed_at || "");
    return !Number.isNaN(completedTime) && Date.now() - completedTime < 24 * 60 * 60 * 1000;
  }

  function toChecklistPdfRecord(checklist: any): ChecklistPdfRecord {
    return {
      title: checklist.title || "Checklist",
      assignedCrew: profile?.full_name || profile?.name || email || "Crew member",
      sender: getChecklistSender(checklist),
      department: checklist.department,
      checklistType: checklist.checklist_type,
      frequency: getChecklistFrequency(checklist),
      status: checklist.status === "completed" ? "Completed" : "Open",
      createdAt: checklist.created_at,
      completedAt: checklist.completed_at,
      dueDate: checklist.due_date,
      captainNote: getCaptainNote(checklist),
      tasks: (checklist.yacht_checklist_items || []).map((task: any) => ({
        title: task.task_text || "Task",
        completed: Boolean(task.completed),
        completedBy: task.completed_by,
        completedAt: task.completed_at,
        beforePhoto: getTaskPhoto(task, "before"),
        afterPhoto: getTaskPhoto(task, "after"),
      })),
    };
  }

  async function downloadArchivedChecklistPdf(checklist: any) {
    const action = `checklist-${checklist.id}`;
    setPdfAction(action);
    try {
      await downloadChecklistPdfDocument([toChecklistPdfRecord(checklist)], {
        fileName: `${safeFileName(checklist.title || "checklist")}-BlueDeck.pdf`,
        title: "BlueDeck Checklist Record",
        subtitle: "Detailed archived checklist and proof record",
        retentionNote: "BlueDeck crew checklist record retained in the six-month archive.",
      });
    } finally {
      setPdfAction("");
    }
  }

  async function downloadCrewArchivePdf() {
    if (checklistGroups.archive.length === 0) return;
    setPdfAction("archive");
    try {
      await downloadChecklistPdfDocument(
        checklistGroups.archive.map(toChecklistPdfRecord),
        {
          fileName: `BlueDeck-crew-checklist-archive-${new Date().toISOString().slice(0, 10)}.pdf`,
          title: "BlueDeck Crew Checklist Archive",
          subtitle: "Complete operational history for the last six months",
          retentionNote: "BlueDeck checklist archive - records are retained for six months.",
        }
      );
    } finally {
      setPdfAction("");
    }
  }

  async function downloadYachtLogPdf() {
    if (yachtLog.length === 0) return;
    setPdfAction("yacht-log");
    try {
      await downloadYachtLogPdfDocument(yachtLog, {
        fileName: `BlueDeck-my-yacht-log-${new Date().toISOString().slice(0, 10)}.pdf`,
        crewName: profile?.full_name || profile?.name || email || "Crew member",
        yachtName: memberships.length === 1
          ? yachts[memberships[0]?.yacht_id]?.name
          : undefined,
      });
    } finally {
      setPdfAction("");
    }
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen min-w-0 overflow-x-hidden text-slate-900">
      <div className="bd-ocean-content bd-crew-task-content mx-auto w-full min-w-0 max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {portalView === "home" && (
          <section className="space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            <PortalCard
              icon={ListChecks}
              title="Checklists"
              description="Open duties, completed work and your six-month checklist archive."
              meta={`${checklistGroups.open.length} open · ${checklistGroups.completed.length} completed`}
              onClick={() => setPortalView("checklists")}
            />
            <PortalCard
              icon={FileText}
              title="My Contract"
              description="Review contracts sent to your crew profile and open mobile signature."
              meta={`${contracts.length} contract${contracts.length === 1 ? "" : "s"}`}
              onClick={() => setPortalView("contracts")}
            />
            <PortalCard
              icon={History}
              title="My Yacht Log"
              description="A dated record of invitations, access, contracts and checklist activity."
              meta={`${yachtLog.length} recorded events`}
              onClick={() => setPortalView("log")}
            />
          </div>
          {invitations.length > 0 && (
            <div className="bd-glass-card-strong rounded-[30px] p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Pending invitation</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Yacht crew access</h2>
                  <p className="mt-2 text-sm text-slate-600">{invitations[0].position || "Crew"} · Sent {formatPortalDate(invitations[0].created_at)}</p>
                </div>
                <button type="button" onClick={() => acceptInvitation(invitations[0])} disabled={acceptingInviteId === invitations[0].id} className="rounded-xl bg-[#071631] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {acceptingInviteId === invitations[0].id ? "Accepting..." : "Accept Invitation"}
                </button>
              </div>
            </div>
          )}
          </section>
        )}

        {portalView !== "home" && (
          <button
            type="button"
            onClick={() => setPortalView("home")}
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-cyan-300"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            My Deck
          </button>
        )}

        {portalView === "checklists" && (
        <aside className="min-w-0 space-y-6">
          <div className="bd-glass-card-strong rounded-[30px] p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {(["open", "completed", "archive"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setChecklistView(view);
                    setActiveChecklist(null);
                  }}
                  className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${
                    checklistView === view
                      ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200"
                  }`}
                >
                  <span className="font-black capitalize">{view}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                    {checklistGroups[view].length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {checklists.length > 0 && (
            <div className="bd-glass-card rounded-[34px] p-4">
              <div className="flex flex-col gap-3 px-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-700">
                  {checklistView === "open" ? "Open Checklists" : checklistView === "completed" ? "Completed Checklists" : "Archive"}
                </p>
                {checklistView === "archive" && checklistGroups.archive.length > 0 && (
                  <button
                    type="button"
                    onClick={downloadCrewArchivePdf}
                    disabled={pdfAction === "archive"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#071631] px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60"
                  >
                    {pdfAction === "archive" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download Archive PDF
                  </button>
                )}
              </div>

              <div className={`space-y-3 ${checklistView === "archive" ? "max-h-[640px] overflow-y-auto pr-2" : ""}`}>
                {checklistGroups[checklistView].map((list) => {
                  const items = list.yacht_checklist_items || [];
                  const done = items.filter((item: any) => item.completed).length;
                  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
                  const active = activeChecklist?.id === list.id;

                  return (
                    <article
                      key={list.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        active
                          ? "border-cyan-300 bg-cyan-600/10"
                          : "border-slate-200 bg-white/70 hover:border-white/20"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveChecklist(active ? null : list)}
                        className="w-full p-5 text-left"
                      >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 data-i18n-ignore className="break-words font-black">{list.title}</h3>
                          <p data-i18n-ignore className="mt-1 text-xs text-slate-500">
                            {list.department} · {list.checklist_type}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            From: <span data-i18n-ignore>{getChecklistSender(list)}</span> · Received {formatPortalDate(list.created_at)}
                          </p>
                        </div>

                        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition ${active ? "rotate-180" : ""}`} />
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-600"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      </button>

                      {active && (
                        <div className="border-t border-cyan-200/70 p-5 sm:p-6">
                          {getCaptainNote(list) && (
                            <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                              Captain note: <span data-i18n-ignore>{getCaptainNote(list)}</span>
                            </p>
                          )}

                          <div className="space-y-3">
                            {items.map((task: any) => (
                              <div key={task.id} className={`rounded-2xl border p-4 ${task.completed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                <button
                                  type="button"
                                  onClick={() => toggleTask(task)}
                                  disabled={
                                    list.status === "completed"
                                    || !canEditChecklist(list)
                                    || updatingTaskId === task.id
                                  }
                                  className="flex w-full items-center gap-3 text-left disabled:cursor-default"
                                >
                                  {updatingTaskId === task.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className={`h-5 w-5 ${task.completed ? "text-emerald-600" : "text-slate-300"}`} />}
                                  <span data-i18n-ignore className={`font-semibold ${task.completed ? "text-slate-500 line-through" : "text-slate-900"}`}>{task.task_text}</span>
                                </button>
                                {checklistView === "archive" || checklistView === "completed" ? (
                                  (getTaskPhoto(task, "before") || getTaskPhoto(task, "after")) && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <ProofThumbnail label="Before" url={getTaskPhoto(task, "before")} onOpen={setPhotoPreview} />
                                      <ProofThumbnail label="After" url={getTaskPhoto(task, "after")} onOpen={setPhotoPreview} />
                                    </div>
                                  )
                                ) : (
                                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <PhotoBox label="Before photo" url={getTaskPhoto(task, "before")} uploading={uploadingPhoto === `before-${task.id}`} onUpload={(file) => uploadTaskPhoto(task, file, "before")} disabled={!canEditChecklist(list)} readOnly={Boolean(getTaskPhoto(task, "before"))} />
                                    <PhotoBox label="After photo" url={getTaskPhoto(task, "after")} uploading={uploadingPhoto === `after-${task.id}`} onUpload={(file) => uploadTaskPhoto(task, file, "after")} disabled={!canEditChecklist(list)} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-5 flex flex-wrap justify-end gap-3">
                            {checklistView === "archive" && (
                              <button
                                type="button"
                                onClick={() => downloadArchivedChecklistPdf(list)}
                                disabled={pdfAction === `checklist-${list.id}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-800 disabled:opacity-60"
                              >
                                {pdfAction === `checklist-${list.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
                              </button>
                            )}
                            {list.status !== "completed" && (
                              <button type="button" onClick={() => completeChecklist(list)} disabled={completingChecklistId === list.id} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                                {completingChecklistId === list.id ? "Completing..." : "Complete Checklist"}
                              </button>
                            )}
                            {list.status === "completed" && canEditChecklist(list) && (
                              <span className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">Proof editable for 24 hours</span>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                {checklistGroups[checklistView].length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-slate-500">
                    No {checklistView} checklist records.
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
        )}

        {portalView === "contracts" && (
          <section className="space-y-4">
            <div className="bd-glass-card-strong rounded-[32px] p-6 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-700">My Contract</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">Seafarer contracts</h2>
              <p className="mt-3 text-slate-600">Contracts sent to your authenticated crew profile remain available here.</p>
            </div>
            {contracts.map((contract) => (
              <article key={contract.id} className="bd-glass-card rounded-[26px] p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">{contract.status || "Draft"}</p>
                    <h3 className="mt-2 text-xl font-black text-slate-950" data-i18n-ignore>{yachts[contract.yacht_id]?.name || "Seafarer Employment Agreement"}</h3>
                    <p className="mt-2 text-sm text-slate-500">Received {formatPortalDate(contract.sent_at || contract.created_at)}</p>
                  </div>
                  <a href="/contracts" className="rounded-xl bg-[#071631] px-5 py-3 text-center text-sm font-black text-white">Open Contract</a>
                </div>
              </article>
            ))}
            {contracts.length === 0 && <EmptyPortalState icon={FileText} text="No contracts have been sent to your crew profile yet." />}
          </section>
        )}

        {portalView === "log" && (
          <section className="space-y-4">
            <div className="bd-glass-card-strong rounded-[32px] p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-700">My Yacht Log</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950">Crew activity record</h2>
                  <p className="mt-3 text-slate-600">A chronological account of your BlueDeck yacht access and operational activity.</p>
                </div>
                {yachtLog.length > 0 && (
                  <button
                    type="button"
                    onClick={downloadYachtLogPdf}
                    disabled={pdfAction === "yacht-log"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#071631] px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60"
                  >
                    {pdfAction === "yacht-log" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download PDF
                  </button>
                )}
              </div>
            </div>
            <div className="bd-glass-card rounded-[30px] p-5 sm:p-7">
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-2">
                {yachtLog.map((event, index) => (
                  <div key={event.id} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-4 pb-5 last:pb-0">
                    <div className="relative flex justify-center">
                      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-cyan-600" />
                      {index < yachtLog.length - 1 && <span className="absolute top-5 h-[calc(100%-8px)] w-px bg-cyan-100" />}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/75 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-black text-slate-950">{event.title}</h3>
                        <span className="text-xs font-bold text-slate-400">{formatPortalDate(event.date)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600" data-i18n-ignore>{event.detail}</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">{event.type}</p>
                    </div>
                  </div>
                ))}
                {yachtLog.length === 0 && <EmptyPortalState icon={History} text="Your yacht activity will appear here after the first invitation or assignment." />}
              </div>
            </div>
          </section>
        )}

        {photoPreview && (
          <div
            className="bd-modal-backdrop fixed inset-0 z-[90] flex items-center justify-center bg-[#071631]/80 p-4 backdrop-blur-sm"
            onClick={() => setPhotoPreview(null)}
          >
            <div
              className="bd-auth-modal-panel w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Proof photo</p>
                  <h3 className="mt-1 text-xl font-black text-[#071631]">{photoPreview.label}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#071631] text-white shadow-md transition hover:bg-cyan-800"
                  aria-label="Close photo preview"
                >
                  <X className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>
              <div className="bd-media-canvas bg-[#071631] p-3">
                <img src={photoPreview.url} alt={`${photoPreview.label} proof`} className="max-h-[76vh] w-full object-contain" />
              </div>
            </div>
          </div>
        )}

        <section className="hidden">
          <div className="bd-glass-card-strong rounded-[40px] p-5 sm:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-cyan-700">
                  <Sparkles className="h-5 w-5" />
                  Crew Work Center
                </p>

                <h2 className="bd-serif mt-3 break-words text-4xl font-normal tracking-tight text-[#071f3c] sm:text-5xl">
                  My YACHT-OS Work Center
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
              <div className="bd-brand-rule h-1.5" />
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
                              YACHT-OS Invitation
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
                        readOnly={Boolean(getTaskPhoto(task, "before"))}
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

function PortalCard({
  icon: Icon,
  title,
  description,
  meta,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="bd-glass-card bd-focus group min-h-56 rounded-[30px] p-6 text-left transition hover:-translate-y-1 hover:border-cyan-300 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#071631] text-white"><Icon className="h-6 w-6" /></span>
        <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-cyan-700" />
      </div>
      <h2 className="mt-6 text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 leading-6 text-slate-600">{description}</p>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-cyan-700">{meta}</p>
    </button>
  );
}

function EmptyPortalState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-slate-500">
      <Icon className="mx-auto h-8 w-8 text-cyan-700" />
      <p className="mt-3">{text}</p>
    </div>
  );
}

function PhotoBox({
  label,
  url,
  uploading,
  onUpload,
  disabled = false,
  readOnly = false,
}: {
  label: string;
  url?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  disabled?: boolean;
  readOnly?: boolean;
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
      {readOnly ? (
        <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-bold text-cyan-900">
          Before photo provided with this task
        </div>
      ) : (
        <label className={`mt-3 flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition ${disabled ? "cursor-default opacity-60" : "cursor-pointer hover:border-cyan-300 hover:text-cyan-800"}`}>
          {uploading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Upload className="h-4 w-4 shrink-0" />}
          <span className="truncate">{uploading ? "Uploading..." : url ? "Replace photo" : "Add photo"}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading || disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}

function ProofThumbnail({
  label,
  url,
  onOpen,
}: {
  label: string;
  url?: string;
  onOpen: (photo: { label: string; url: string }) => void;
}) {
  if (!url) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen({ label, url })}
      className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:border-cyan-300 hover:shadow-lg"
      title={`Open ${label.toLowerCase()} proof photo`}
    >
      <img src={url} alt={`${label} proof`} className="h-full w-full object-contain p-1 transition group-hover:scale-[1.02]" />
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#071631]/90 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
        {label}
      </span>
    </button>
  );
}

function formatPortalDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getChecklistSender(checklist: any) {
  return (
    checklist?.assigned_by_name ||
    checklist?.captain_name ||
    checklist?.created_by_name ||
    checklist?.items?.assigned_by_name ||
    checklist?.items?.captain_name ||
    "Captain / Yacht Operations"
  );
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "checklist";
}

function getCaptainNote(checklist: any) {
  return checklist?.captain_note || checklist?.items?.captain_note || "";
}

function getChecklistFrequency(checklist: any) {
  return checklist?.frequency || checklist?.items?.frequency || "";
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
  if (task?.__bluedeck_signed_photos) {
    return task.__bluedeck_signed_photos[type] || "";
  }

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
