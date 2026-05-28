"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  Anchor,
  Bell,
  Camera,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Clock3,
  LifeBuoy,
  Plus,
  RefreshCcw,
  ShipWheel,
  Trash2,
  Utensils,
  UserRound,
  Wrench,
  Waves,
  X,
} from "lucide-react";
import { saveYachtMembership } from "../../../lib/yachtMemberships";
import {
  canAssignChecklistDepartment,
  canAssignToCrew,
  checklistFrequencies,
  checklistTemplates,
  getAssignableDepartments,
  getDefaultPositionForAccountType,
  getDepartmentByPosition,
  positionSelectGroups,
  yachtDepartments,
} from "../../../lib/yachtOperations";

const yachtId = "f434e90f-b8d8-443c-ad23-d5cedbe4308f";

export default function CrewPage({
  view = "command",
}: {
  view?: "command" | "checklists";
}) {
  const isChecklistSystem = view === "checklists";
  const [crew, setCrew] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [selectedCrew, setSelectedCrew] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [crewPublicId, setCrewPublicId] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("Deckhand");
  const [department, setDepartment] = useState("Deck");
  const [frequency, setFrequency] = useState("Template default");
  const [dueDate, setDueDate] = useState("");
  const [captainNote, setCaptainNote] = useState("");
  const [contractText, setContractText] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ label: string; url: string } | null>(null);
  const [expandedProgress, setExpandedProgress] = useState<string[]>([]);
  const [expandedTemplateTasks, setExpandedTemplateTasks] = useState<string[]>([]);
  const [templateTaskDrafts, setTemplateTaskDrafts] = useState<Record<string, string[]>>({});
  const [newTemplateTasks, setNewTemplateTasks] = useState<Record<string, string>>({});
  const [operator, setOperator] = useState({
    position: "",
    department: "",
    role: "",
  });
  const [templateDepartmentFilter, setTemplateDepartmentFilter] = useState("All");
  const [templateFrequencyFilter, setTemplateFrequencyFilter] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");

  const assignableDepartments = useMemo(
    () => getAssignableDepartments(operator.position, operator.department),
    [operator.department, operator.position]
  );

  const assignableCrew = useMemo(() => {
    return crew.filter((member) =>
      canAssignToCrew(
        operator.position,
        operator.department,
        member.position || member.crew_profiles?.current_position,
        member.department,
        operator.role
      )
    );
  }, [crew, operator.department, operator.position, operator.role]);

  const availableTemplates = useMemo(() => {
    return checklistTemplates.filter((template) =>
      canAssignChecklistDepartment(
        operator.position,
        operator.department,
        template.department,
        operator.role
      )
    );
  }, [operator.department, operator.position, operator.role]);

  const visibleTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();

    return availableTemplates.filter((template) => {
      const matchesDepartment =
        templateDepartmentFilter === "All" || template.department === templateDepartmentFilter;
      const matchesFrequency =
        templateFrequencyFilter === "All" || template.frequency === templateFrequencyFilter;
      const matchesSearch =
        !search ||
        `${template.title} ${template.department} ${template.type} ${template.summary} ${template.tasks.join(" ")}`
          .toLowerCase()
          .includes(search);

      return matchesDepartment && matchesFrequency && matchesSearch;
    });
  }, [availableTemplates, templateDepartmentFilter, templateFrequencyFilter, templateSearch]);

  function toggleProgressCard(id: string) {
    setExpandedProgress((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleTemplateTaskPanel(id: string) {
    setExpandedTemplateTasks((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function getTemplateAssignmentTasks(template: { id: string; tasks: string[] }) {
    return templateTaskDrafts[template.id] || template.tasks;
  }

  function updateTemplateTask(templateId: string, baseTasks: string[], index: number, value: string) {
    const next = [...(templateTaskDrafts[templateId] || baseTasks)];
    next[index] = value;
    setTemplateTaskDrafts((current) => ({ ...current, [templateId]: next }));
  }

  function removeTemplateTask(templateId: string, baseTasks: string[], index: number) {
    const next = [...(templateTaskDrafts[templateId] || baseTasks)].filter((_, taskIndex) => taskIndex !== index);
    setTemplateTaskDrafts((current) => ({ ...current, [templateId]: next }));
  }

  function addTemplateTask(templateId: string, baseTasks: string[]) {
    const task = (newTemplateTasks[templateId] || "").trim();
    if (!task) return;

    const next = [...(templateTaskDrafts[templateId] || baseTasks), task];
    setTemplateTaskDrafts((current) => ({ ...current, [templateId]: next }));
    setNewTemplateTasks((current) => ({ ...current, [templateId]: "" }));
  }

  function resetTemplateTasks(templateId: string) {
    setTemplateTaskDrafts((current) => {
      const next = { ...current };
      delete next[templateId];
      return next;
    });
    setNewTemplateTasks((current) => {
      const next = { ...current };
      delete next[templateId];
      return next;
    });
  }

  async function loadData(silent = false) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    let crewResponse = await supabase
      .from("yacht_crew_memberships")
      .select(`
        *,
        crew_profiles (
          id,
          user_id,
          email,
          full_name,
          current_position,
          phone,
          nationality,
          passport_number,
          passport_expiry,
          stcw_expiry,
          medical_expiry
        )
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (isSchemaCacheError(crewResponse.error)) {
      crewResponse = await supabase
        .from("yacht_crew_memberships")
        .select(`
          *,
          crew_profiles (
            id,
            user_id,
            email,
            full_name,
            current_position,
            phone,
            nationality
          )
        `)
        .eq("yacht_id", yachtId)
        .order("created_at", { ascending: false });
    }

    const { data: crewData, error: crewError } = crewResponse;

    if (crewError) {
      if (!silent) alert(crewError.message);
      return;
    }

    const { data: checklistData, error: checklistError } = await supabase
      .from("yacht_checklists")
      .select(`
        *,
        yacht_checklist_items (*)
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (checklistError) {
      if (!silent) alert(checklistError.message);
      return;
    }

    setCrew(crewData || []);
    setChecklists(checklistData || []);
    loadCurrentOperator(crewData || [], user);
  }

  function loadCurrentOperator(crewData: any[], user: any) {
    const role =
      typeof user?.user_metadata?.role === "string"
        ? user.user_metadata.role
        : "";

    const normalizedUserEmail = normalizeEmail(user.email);
    const membership = crewData.find((member) => {
      return (
        member.crew_profiles?.user_id === user.id ||
        normalizeEmail(member.crew_profiles?.email) === normalizedUserEmail ||
        normalizeEmail(member.invited_email) === normalizedUserEmail
      );
    });

    if (!membership && role !== "captain" && role !== "management") {
      setOperator({ position: "", department: "", role });
      return;
    }

    const operatorPosition =
      membership?.position ||
      membership?.crew_profiles?.current_position ||
      getDefaultPositionForAccountType(role);

    setOperator({
      position: operatorPosition || "",
      department: membership?.department || getDepartmentByPosition(operatorPosition),
      role,
    });
  }

  useEffect(() => {
    loadData();
    const interval = window.setInterval(() => loadData(true), 10000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!photoPreview) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPhotoPreview(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photoPreview]);

  useEffect(() => {
    setSelectedTemplates((current) =>
      current.filter((id) => availableTemplates.some((template) => template.id === id))
    );
  }, [availableTemplates]);

  useEffect(() => {
    if (!selectedCrew) return;
    if (!assignableCrew.some((member) => member.id === selectedCrew)) {
      setSelectedCrew("");
    }
  }, [assignableCrew, selectedCrew]);

  async function addCrew() {
    if (!inviteEmail && !crewPublicId) {
      alert("Crew email or Crew ID required");
      return;
    }

    if (!canAssignToCrew(operator.position, operator.department, position, department, operator.role)) {
      alert("You can only invite crew within your BlueDeck hierarchy.");
      return;
    }

    setLoading(true);

    const lookup = crewPublicId.trim().toUpperCase();
    let profile = null;
    let profileError = null;

    if (lookup) {
      const response = await supabase
        .from("crew_profiles")
        .select("*")
        .eq("public_crew_id", lookup)
        .maybeSingle();
      profile = response.data;
      profileError = response.error;
    }

    if (!profile && inviteEmail) {
      const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
      const existingProfile = await supabase
        .from("crew_profiles")
        .select("*")
        .eq("email", normalizedInviteEmail)
        .limit(1);

      if (existingProfile.error) {
        profileError = existingProfile.error;
      } else if (existingProfile.data?.[0]) {
        profile = existingProfile.data[0];

        if ((fullName && !profile.full_name) || !profile.current_position) {
          await supabase
            .from("crew_profiles")
            .update({
              ...(fullName && !profile.full_name ? { full_name: fullName } : {}),
              ...(!profile.current_position ? { current_position: position } : {}),
            })
            .eq("id", profile.id);
        }
      } else {
        const response = await insertCrewProfile({
          email: normalizedInviteEmail,
          full_name: fullName,
          current_position: position,
          public_crew_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
        });

        profile = response.data;
        profileError = response.error;
      }
    }

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (!profile?.id) {
      alert("Crew profile could not be created. Please check the Crew ID or email.");
      setLoading(false);
      return;
    }

    const token = crypto.randomUUID();
    const inviteOrigin =
      window.location.hostname === "localhost"
        ? "https://bluedeck.app"
        : window.location.origin;
    const inviteLink = `${inviteOrigin}/invitations/${token}`;

    const { error: inviteError } = await insertCrewInvitation({
      yacht_id: yachtId,
      crew_profile_id: profile.id,
      invited_email: inviteEmail || profile.email,
      public_crew_id: profile.public_crew_id,
      position,
      department,
      status: "pending",
      token,
      invite_link: inviteLink,
    });

    if (inviteError) {
      alert(inviteError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await saveYachtMembership(supabase, {
      yacht_id: yachtId,
      crew_profile_id: profile.id,
      invited_email: inviteEmail || profile.email,
      position,
      department,
      status: "invited",
    });

    if (memberError) {
      alert(memberError.message);
      setLoading(false);
      return;
    }

    setInviteEmail("");
    setCrewPublicId("");
    setFullName("");
    setInviteNotice("Invitation is now waiting inside the crew member's My YachtOS portal.");
    setLoading(false);
    loadData();

    alert("Crew invitation created. The crew member will see it inside My YachtOS.");
  }

  async function insertCrewProfile(payload: Record<string, any>) {
    const variants = [payload, omitKeys(payload, ["public_crew_id"])];
    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("crew_profiles")
        .insert(variant)
        .select()
        .single();

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  async function insertCrewInvitation(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["invite_link"]),
      omitKeys(payload, ["public_crew_id"]),
      omitKeys(payload, ["invite_link", "public_crew_id"]),
    ];
    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase.from("crew_invitations").insert(variant);

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  function toggleTemplate(key: string) {
    setSelectedTemplates((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  async function assignSelectedChecklists() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    if (selectedTemplates.length === 0) {
      alert("Select checklist");
      return;
    }

    setLoading(true);

    const member = crew.find((item) => item.id === selectedCrew);
    if (
      !member ||
      !canAssignToCrew(
        operator.position,
        operator.department,
        member.position || member.crew_profiles?.current_position,
        member.department,
        operator.role
      )
    ) {
      alert("You can only assign checklists to crew below you in the yacht hierarchy.");
      setLoading(false);
      return;
    }

    for (const key of selectedTemplates) {
      const template = checklistTemplates.find((item) => item.id === key);
      if (!template) continue;
      if (
        !canAssignChecklistDepartment(
          operator.position,
          operator.department,
          template.department,
          operator.role
        )
      ) {
        alert(`${template.title} is outside your checklist authority.`);
        continue;
      }

      const assignmentTasks = getTemplateAssignmentTasks(template)
        .map((task) => task.trim())
        .filter(Boolean);

      if (assignmentTasks.length === 0) {
        alert(`${template.title} has no task items to assign.`);
        continue;
      }

      const { data: checklist, error } = await createChecklist({
        yacht_id: yachtId,
        title: template.title,
        department: template.department,
        checklist_type: template.type,
        assigned_to: member?.crew_profile_id,
        due_date: dueDate || null,
        status: "open",
        items: {
          frequency: frequency === "Template default" ? template.frequency : frequency,
          captain_note: captainNote || null,
          tasks: assignmentTasks,
          source_template: template.id,
          summary: template.summary,
        },
      });

      if (error) {
        alert(error.message);
        continue;
      }

      const tasks = assignmentTasks.map((task: string) => ({
        checklist_id: checklist.id,
        task_text: task,
        completed: false,
      }));

      const { error: itemError } = await insertChecklistItems(tasks);
      if (itemError) alert(itemError.message);
    }

    setSelectedTemplates([]);
    setCaptainNote("");
    setDueDate("");
    setLoading(false);
    loadData();

    alert("Checklist assigned.");
  }

  async function createChecklist(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["items"]),
      omitKeys(payload, ["items", "due_date"]),
      omitKeys(payload, ["items", "due_date", "status"]),
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

  async function insertChecklistItems(tasks: any[]) {
    const variants = [
      tasks,
      tasks.map((task) => omitKeys(task, ["completed"])),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase.from("yacht_checklist_items").insert(variant);
      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  async function deleteChecklist(id: string) {
    if (!confirm("Delete checklist?")) return;

    await supabase.from("yacht_checklists").delete().eq("id", id);
    loadData();
  }

  async function assignContract() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    if (!contractText.trim()) {
      alert("Contract text required");
      return;
    }

    const member = crew.find((item) => item.id === selectedCrew);

    const { error } = await insertContract({
      yacht_id: yachtId,
      crew_profile_id: member?.crew_profile_id,
      membership_id: selectedCrew,
      contract_text: contractText,
      status: "sent_for_signature",
      sent_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    setContractText("");
    alert("Contract sent for mobile signature.");
  }

  async function insertContract(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["sent_at"]),
      omitKeys(payload, ["membership_id"]),
      omitKeys(payload, ["sent_at", "membership_id"]),
    ];
    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase.from("yacht_contracts").insert(variant);

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  return (
    <main className="bd-crew-command-page min-h-screen bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] px-4 py-5 pb-12 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-6 overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:mb-10 sm:rounded-[40px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#08111f,#22d3ee,#d8b45f,#ef776f)]" />
          <div className="p-5 sm:p-10">
            <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">
              {isChecklistSystem ? "BlueDeck ChecklistOS" : "BlueDeck CrewOS"}
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
              {isChecklistSystem ? "Checklist System" : "Yacht Crew Command"}
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-500 sm:mt-5 sm:text-xl">
              {isChecklistSystem
                ? "Assign professional yacht checklists through the correct onboard hierarchy, review crew progress and keep proof records in one focused workspace."
                : "Invite crew, manage onboard roles and send yacht contracts from one clean crew command workspace."}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 md:mb-10 md:grid-cols-4 md:gap-6">
          <Stat title="Crew" value={crew.length} icon={<Bell />} />
          {isChecklistSystem ? (
            <>
              <Stat title="Open Checklists" value={checklists.length} icon={<ClipboardList />} />
              <Stat title="Library" value={`${checklistTemplates.length} templates`} icon={<ShipWheel />} />
            </>
          ) : (
            <>
              <Stat title="Assignable Crew" value={assignableCrew.length} icon={<UserRound />} />
              <Stat
                title="Invited"
                value={crew.filter((member) => member.status === "invited").length}
                icon={<Plus />}
              />
            </>
          )}
          <Stat title="Authority" value={operator.position} icon={<CheckSquare />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr] xl:gap-8">
          <div className="space-y-6 xl:space-y-8">
            {!isChecklistSystem && (
            <div className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-[0_18px_40px_rgba(8,145,178,0.22)]">
                  <Plus />
                </div>
                <div>
                  <p className="text-cyan-700">Captain Action</p>
                  <h2 className="text-3xl font-black sm:text-4xl">Invite Crew</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                <input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <input
                  placeholder="Crew ID"
                  value={crewPublicId}
                  onChange={(e) => setCrewPublicId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <input
                  placeholder="Crew email, if Crew ID is not known"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <select
                  value={position}
                  onChange={(e) => {
                    const nextPosition = e.target.value;
                    setPosition(nextPosition);
                    setDepartment(getDepartmentByPosition(nextPosition));
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                >
                  {positionSelectGroups.map((group) => (
                    <optgroup key={group.department} label={group.department}>
                      {group.positions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                >
                  {yachtDepartments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <button
                  onClick={addCrew}
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan-600 py-4 text-xl font-bold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Create Invitation"}
                </button>

                {inviteNotice && (
                  <div className="rounded-2xl border border-cyan-400/25 bg-cyan-50 p-4 text-sm text-slate-700">
                    <p className="font-bold">Invitation sent</p>
                    <p className="mt-2 leading-6">{inviteNotice}</p>
                  </div>
                )}
              </div>
            </div>
            )}

            {isChecklistSystem && (
            <div className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
              <p className="text-cyan-700">Assign To</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Crew Member</h2>

              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="mt-8 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
              >
                <option value="">Select crew</option>
                {assignableCrew.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.crew_profiles?.full_name || member.invited_email} — {member.position}
                  </option>
                ))}
              </select>
              {assignableCrew.length === 0 && (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-slate-600">
                  No crew below your current hierarchy is available for assignment yet.
                </p>
              )}

              <button
                onClick={assignSelectedChecklists}
                disabled={loading}
                className="mt-5 w-full rounded-2xl bg-slate-950 py-4 text-xl font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {loading ? "Assigning..." : "Assign Selected Checklists"}
              </button>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                >
                  {checklistFrequencies.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                />
              </div>

              <textarea
                placeholder="Captain note for this checklist"
                value={captainNote}
                onChange={(e) => setCaptainNote(e.target.value)}
                className="mt-4 h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
              />
            </div>
            )}

            {!isChecklistSystem && (
            <div className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
              <p className="text-cyan-700">Contract</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">Assign Yacht Contract</h2>
              <p className="mt-3 text-slate-500">
                Select a crew member above, paste the contract text, and send it
                for mobile signature.
              </p>
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
              >
                <option value="">Select crew for contract</option>
                {assignableCrew.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.crew_profiles?.full_name || member.invited_email} — {member.position}
                  </option>
                ))}
              </select>
              <textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Contract terms, dates, salary, position, vessel name..."
                className="mt-6 h-40 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
              />
              <button
                onClick={assignContract}
                className="mt-5 w-full rounded-2xl bg-cyan-600 py-4 text-xl font-bold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700"
              >
                Send Contract for Signature
              </button>
            </div>
            )}

            {isChecklistSystem && (
            <div className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-cyan-700">Assigned Work</p>
                  <h2 className="mt-2 text-3xl font-black sm:text-4xl">Crew Progress</h2>
                </div>
                <button
                  onClick={() => loadData()}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-700 transition hover:border-cyan-300"
                  title="Refresh crew progress"
                >
                  <RefreshCcw className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-8 space-y-4">
                {checklists.map((item) => {
                  const progress = getChecklistProgress(item);
                  const assignedCrew = crew.find(
                    (member) => member.crew_profile_id === item.assigned_to
                  );
                  const tasks = item.yacht_checklist_items || [];
                  const expanded = expandedProgress.includes(item.id);
                  const crewName =
                    assignedCrew?.crew_profiles?.full_name ||
                    assignedCrew?.invited_email ||
                    "Crew member";
                  const metaLine = [
                    item.department,
                    item.checklist_type,
                    getChecklistFrequency(item),
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/10"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleProgressCard(item.id)}
                        onKeyDown={(event) => {
                          if (event.currentTarget !== event.target) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleProgressCard(item.id);
                          }
                        }}
                        className="bd-focus block w-full cursor-pointer p-5 text-left"
                        aria-expanded={expanded}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="break-words text-xl font-black text-slate-950 sm:truncate">
                              {item.title || "Checklist"}
                            </h3>
                            <p className="mt-1 text-sm font-semibold text-cyan-700">
                              {metaLine || "Assigned checklist"}
                            </p>
                            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-600">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                                <UserRound className="h-4 w-4" />
                              </span>
                              <span className="truncate">{crewName}</span>
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-start">
                            <span className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500 sm:inline-flex">
                              {expanded ? "Hide details" : "View details"}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteChecklist(item.id);
                              }}
                              className="bd-focus flex h-10 w-10 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-[#b9423b] transition hover:border-rose-200 hover:bg-rose-100"
                              title="Delete checklist"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl bg-[linear-gradient(135deg,#0e7490,#22d3ee)] p-4 text-white shadow-lg shadow-cyan-700/20">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-black">
                              {progress.done}/{progress.total} completed
                            </span>
                            <span className="font-black">{progress.percent}%</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white/28">
                            <div
                              className="h-full rounded-full bg-white transition-all"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-slate-100 px-5 pb-5">
                          {getChecklistNote(item) && (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-slate-700">
                              Captain note: {getChecklistNote(item)}
                            </div>
                          )}

                          <div className="mt-5 space-y-3">
                            {tasks.map((task: any) => {
                              const beforePhoto = getTaskPhoto(task, "before");
                              const afterPhoto = getTaskPhoto(task, "after");

                              return (
                                <div
                                  key={task.id}
                                  className={`rounded-2xl border p-4 ${
                                    task.completed
                                      ? "border-emerald-200 bg-emerald-50"
                                      : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                                        task.completed
                                          ? "border-emerald-500 bg-emerald-500 text-white"
                                          : "border-slate-300 bg-white text-slate-300"
                                      }`}
                                    >
                                      {task.completed && <CheckCircle className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`font-semibold ${
                                          task.completed ? "text-slate-700" : "text-slate-500"
                                        }`}
                                      >
                                        {task.task_text}
                                      </p>
                                      {task.completed && (
                                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                          <Clock3 className="h-3.5 w-3.5 text-cyan-700" />
                                          Done by {task.completed_by || assignedCrew?.crew_profiles?.email || "crew"}
                                          {task.completed_at ? ` · ${formatDateTime(task.completed_at)}` : ""}
                                        </p>
                                      )}

                                      {(beforePhoto || afterPhoto) && (
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                          <TaskPhotoPreview label="Before" url={beforePhoto} onOpen={setPhotoPreview} />
                                          <TaskPhotoPreview label="After" url={afterPhoto} onOpen={setPhotoPreview} />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {tasks.length === 0 && (
                              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                This checklist has no task items yet.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                {checklists.length === 0 && (
                  <p className="text-slate-500">No assigned checklist yet.</p>
                )}
              </div>
            </div>
            )}
          </div>

          <div className="space-y-6 xl:space-y-8">
            {!isChecklistSystem && (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      Crew Directory
                    </p>
                    <h2 className="mt-2 text-3xl font-black sm:text-5xl">Onboard Team</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                      Crew profiles, yacht roles, invitations and contract readiness in one
                      clean captain command view.
                    </p>
                  </div>
                  <UserRound className="h-10 w-10 text-cyan-700" />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {crew.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="truncate text-lg font-black text-slate-950">
                        {member.crew_profiles?.full_name || member.invited_email || "Crew member"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-cyan-700">
                        {member.position || member.crew_profiles?.current_position || "Crew"} · {member.department || "Yacht"}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        {member.status || "active"}
                      </p>
                    </article>
                  ))}

                  {crew.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                      No crew has been added yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {isChecklistSystem && (
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-start gap-4">
                  <DepartmentIcon department="Command" />
                  <div>
                    <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      Professional Yacht Library
                    </p>
                    <h2 className="text-3xl font-black sm:text-5xl">Checklist System</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                      Command, deck, engineering, interior, galley, safety, toys and guest
                      operations are grouped for fast assignment without crowding the page.
                    </p>
                  </div>
                </div>

                <div className="w-full rounded-3xl border border-cyan-100 bg-cyan-50 px-5 py-4 text-sm text-slate-600 sm:w-auto">
                  <p className="font-black text-slate-950">{operator.position}</p>
                  <p className="mt-1">
                    {availableTemplates.length === checklistTemplates.length
                      ? "Full captain access"
                      : `Allowed: ${assignableDepartments.join(", ") || operator.department}`}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:mt-8 lg:grid-cols-[1.2fr_0.9fr_0.9fr] lg:gap-4">
                <input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Search checklist, task or department"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />
                <select
                  value={templateDepartmentFilter}
                  onChange={(event) => setTemplateDepartmentFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option value="All">All departments</option>
                  {yachtDepartments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={templateFrequencyFilter}
                  onChange={(event) => setTemplateFrequencyFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option value="All">All frequencies</option>
                  {checklistFrequencies
                    .filter((item) => item !== "Template default")
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.14em]">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-500">
                  {visibleTemplates.length} visible
                </span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-cyan-800">
                  {selectedTemplates.length} selected
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-500">
                  {availableTemplates.length} authorized
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:mt-8 md:grid-cols-2 2xl:grid-cols-3">
                {visibleTemplates.map((template) => {
                  const selected = selectedTemplates.includes(template.id);
                  const taskPanelOpen = expandedTemplateTasks.includes(template.id);
                  const assignmentTasks = getTemplateAssignmentTasks(template);
                  const trimmedTasks = assignmentTasks.map((task) => task.trim()).filter(Boolean);

                  return (
                    <article
                      key={template.id}
                      className={`bd-checklist-template-card rounded-[24px] border p-4 text-left transition sm:rounded-[28px] sm:p-5 ${
                        selected
                          ? "border-cyan-400 bg-cyan-50 shadow-[0_18px_50px_rgba(8,145,178,0.12)]"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-950/10"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleTemplate(template.id)}
                            className={`bd-focus mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                              selected
                                ? "border-cyan-600 bg-cyan-600 text-white shadow-lg shadow-cyan-700/20"
                                : "border-slate-300 bg-white text-slate-300 hover:border-cyan-300 hover:text-cyan-700"
                            }`}
                            aria-pressed={selected}
                            title={selected ? "Remove from assignment" : "Select checklist"}
                          >
                            {selected ? <CheckCircle className="h-5 w-5" /> : <ClipboardList className="h-4 w-4" />}
                          </button>

                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                              {template.department} · {template.type}
                            </p>
                            <h3 className="mt-2 break-words text-xl font-black text-slate-950 sm:text-2xl">{template.title}</h3>
                          </div>
                        </div>

                        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {template.frequency}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-500">{template.summary}</p>

                      <button
                        type="button"
                        onClick={() => toggleTemplateTaskPanel(template.id)}
                        className="bd-focus mt-4 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-white px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 sm:w-auto sm:justify-start sm:rounded-full sm:py-2"
                        aria-expanded={taskPanelOpen}
                      >
                        <span>{trimmedTasks.length} tasks</span>
                        <span className="text-cyan-700">{taskPanelOpen ? "Close" : "Review"}</span>
                        <ChevronDown className={`h-4 w-4 transition ${taskPanelOpen ? "rotate-180" : ""}`} />
                      </button>

                      {taskPanelOpen && (
                        <div className="mt-5 rounded-3xl border border-cyan-100 bg-[#f8fcfd] p-3 shadow-inner shadow-cyan-950/5 sm:p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                              Assignment tasks
                            </p>
                            <button
                              type="button"
                              onClick={() => resetTemplateTasks(template.id)}
                              className="bd-focus rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-cyan-300 hover:text-cyan-800"
                            >
                              Reset
                            </button>
                          </div>

                          <div className="mt-4 space-y-2.5">
                            {assignmentTasks.map((task, index) => (
                              <div key={`${template.id}-${index}`} className="flex items-center gap-2">
                                <input
                                  value={task}
                                  onChange={(event) =>
                                    updateTemplateTask(template.id, template.tasks, index, event.target.value)
                                  }
                                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeTemplateTask(template.id, template.tasks, index)}
                                  className="bd-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-white text-[#b9423b] transition hover:border-rose-200 hover:bg-rose-50"
                                  title="Remove task"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}

                            {assignmentTasks.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                                Add at least one task before assigning this checklist.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex gap-2">
                            <input
                              value={newTemplateTasks[template.id] || ""}
                              onChange={(event) =>
                                setNewTemplateTasks((current) => ({
                                  ...current,
                                  [template.id]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addTemplateTask(template.id, template.tasks);
                                }
                              }}
                              placeholder="New task"
                              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                            />
                            <button
                              type="button"
                              onClick={() => addTemplateTask(template.id, template.tasks)}
                              className="bd-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/12 transition hover:bg-cyan-800"
                              title="Add task"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                {visibleTemplates.length === 0 && (
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-500">
                    No checklist matches this filter or your current hierarchy authority.
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {photoPreview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl shadow-slate-950/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                  Task Photo
                </p>
                <h3 className="text-2xl font-black text-slate-950">{photoPreview.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                aria-label="Close photo preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950">
              <img
                src={photoPreview.url}
                alt={`${photoPreview.label} task photo`}
                className="max-h-[78vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DepartmentIcon({ department }: any) {
  if (department === "Command") return <ShipWheel className="h-12 w-12 text-cyan-700" />;
  if (department === "Deck") return <ShipWheel className="h-12 w-12 text-cyan-700" />;
  if (department === "Interior") return <Utensils className="h-12 w-12 text-[#b9427b]" />;
  if (department === "Galley") return <Utensils className="h-12 w-12 text-[#c46d24]" />;
  if (department === "Engineering") return <Wrench className="h-12 w-12 text-[#c46d24]" />;
  if (department === "Toys") return <Waves className="h-12 w-12 text-blue-700" />;
  if (department === "Guest") return <Anchor className="h-12 w-12 text-[#1f6f8b]" />;
  if (department === "Purser") return <ClipboardList className="h-12 w-12 text-[#1f6f8b]" />;
  if (department === "Security") return <CheckSquare className="h-12 w-12 text-[#1f6f8b]" />;
  if (department === "Medical") return <LifeBuoy className="h-12 w-12 text-emerald-700" />;
  return <LifeBuoy className="h-12 w-12 text-[#b9423b]" />;
}

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function omitKeys<T extends Record<string, any>>(value: T, keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key))
  );
}

function isSchemaCacheError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return message.toLowerCase().includes("schema cache");
}

function getChecklistProgress(checklist: any) {
  const tasks = checklist?.yacht_checklist_items || [];
  const total = tasks.length;
  const done = tasks.filter((task: any) => task.completed).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function getChecklistFrequency(checklist: any) {
  return checklist?.frequency || checklist?.items?.frequency || "";
}

function getChecklistNote(checklist: any) {
  return checklist?.captain_note || checklist?.items?.captain_note || "";
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

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskPhotoPreview({
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
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-950/10"
    >
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
        <Camera className="h-3.5 w-3.5 text-cyan-700" />
        {label}
      </div>
      <img
        src={url}
        alt={`${label} task photo`}
        className="h-28 w-full object-cover transition group-hover:scale-[1.02]"
      />
    </button>
  );
}

function Stat({ title, value, icon }: any) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-cyan-950/5">
      <div className="flex items-center justify-between">
        <div className="text-cyan-700">{icon}</div>
        <div className="text-right">
          <p className="text-slate-500">{title}</p>
          <h2 className="mt-2 text-3xl font-black">{value}</h2>
        </div>
      </div>
    </div>
  );
}
