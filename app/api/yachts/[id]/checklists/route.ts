import { NextResponse } from "next/server";
import { parseSupabaseStorageObjectUrl } from "../../../../lib/imageDelivery";
import { requireRequestUser, RequestAuthError } from "../../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabaseAdmin";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import {
  canAssignChecklistDepartment,
  canAssignToCrew,
  canInviteCrew,
  checklistFrequencies,
  getDepartmentByPosition,
  getPosition,
  yachtDepartments,
} from "../../../../lib/yachtOperations";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

const maximumRequestBytes = 100_000;
const maximumTasks = 80;
const maximumTaskTextLength = 500;
const maximumTitleLength = 160;
const maximumChecklistTypeLength = 120;
const maximumCaptainNoteLength = 2_000;
const maximumPhotoUrlLength = 2_048;

type ChecklistRequest = {
  membershipId?: unknown;
  title?: unknown;
  department?: unknown;
  checklistType?: unknown;
  frequency?: unknown;
  dueDate?: unknown;
  captainNote?: unknown;
  tasks?: unknown;
};

type ChecklistDeleteRequest = {
  checklistId?: unknown;
};

type ValidatedTask = {
  text: string;
  beforePhotoUrl: string | null;
};

type ValidationResult =
  | {
      ok: true;
      value: {
        membershipId: string;
        title: string;
        department: string;
        checklistType: string;
        frequency: string;
        dueDate: string | null;
        captainNote: string | null;
        tasks: ValidatedTask[];
      };
    }
  | {
      ok: false;
      error: string;
    };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
      return jsonResponse(
        { ok: false, error: "Checklist request is too large." },
        413,
      );
    }

    const { id: yachtIdValue } = await context.params;
    const yachtId = yachtIdValue.trim().toLowerCase();
    if (!isUuid(yachtId)) {
      return jsonResponse({ ok: false, error: "Select a valid yacht." }, 400);
    }

    const { user } = await requireRequestUser(request);

    let body: ChecklistRequest;
    try {
      const parsedBody: unknown = await request.json();
      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return jsonResponse({ ok: false, error: "Invalid checklist request." }, 400);
      }
      body = parsedBody as ChecklistRequest;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid checklist request." }, 400);
    }

    const validation = validateChecklistRequest(body, yachtId);
    if (!validation.ok) {
      return jsonResponse({ ok: false, error: validation.error }, 400);
    }

    const admin = getSupabaseAdmin();
    const [{ data: yacht, error: yachtError }, targetMembershipResult] =
      await Promise.all([
        admin
          .from("yachts")
          .select("id,owner_id")
          .eq("id", yachtId)
          .maybeSingle(),
        admin
          .from("yacht_crew_memberships")
          .select("id,crew_profile_id,position,department,status")
          .eq("id", validation.value.membershipId)
          .eq("yacht_id", yachtId)
          .maybeSingle(),
      ]);

    if (yachtError) {
      return databaseError("Yacht access could not be verified.", yachtError);
    }
    if (!yacht) {
      return jsonResponse({ ok: false, error: "Yacht not found." }, 404);
    }
    if (targetMembershipResult.error) {
      return databaseError(
        "Crew assignment could not be verified.",
        targetMembershipResult.error,
      );
    }

    const targetMembership = targetMembershipResult.data;
    if (!targetMembership) {
      return jsonResponse(
        { ok: false, error: "Crew member was not found on this yacht." },
        404,
      );
    }
    if (normalizeStatus(targetMembership.status) !== "active") {
      return jsonResponse(
        { ok: false, error: "Checklists can only be assigned to active crew members." },
        409,
      );
    }
    if (!targetMembership.crew_profile_id) {
      return jsonResponse(
        { ok: false, error: "The selected crew member does not have an active profile." },
        409,
      );
    }

    const targetPosition = getPosition(targetMembership.position);
    if (!targetPosition) {
      return jsonResponse(
        { ok: false, error: "The selected crew member has an invalid yacht position." },
        409,
      );
    }

    const isYachtOwner = yacht.owner_id === user.id;
    let actorMembership: {
      crew_profile_id?: string | null;
      position?: string | null;
      department?: string | null;
      status?: string | null;
    } | null = null;

    if (!isYachtOwner) {
      const actorProfileResult = await findActorProfile(
        admin,
        user.id,
      );
      if (actorProfileResult.error) {
        return databaseError(
          "Your yacht membership could not be verified.",
          actorProfileResult.error,
        );
      }

      const actorMembershipResult = await findActorMembership(
        admin,
        yachtId,
        actorProfileResult.data?.id || "",
      );
      if (actorMembershipResult.error) {
        return databaseError(
          "Your yacht membership could not be verified.",
          actorMembershipResult.error,
        );
      }
      actorMembership = actorMembershipResult.data;

      if (!actorMembership || normalizeStatus(actorMembership.status) !== "active") {
        return jsonResponse(
          { ok: false, error: "An active yacht membership is required." },
          403,
        );
      }
      if (!getPosition(actorMembership.position)) {
        return jsonResponse(
          { ok: false, error: "Your yacht position does not include checklist authority." },
          403,
        );
      }
    }

    const actorPosition = isYachtOwner ? "Owner" : actorMembership?.position || "";
    const actorDepartment = getDepartmentByPosition(actorPosition);
    const targetDepartment = targetPosition.department;
    const accountRole = isYachtOwner ? "owner" : "crew";
    const protectedTargetPosition = ["owner", "yacht manager"].includes(
      targetPosition.title.trim().toLowerCase(),
    );

    const canAssignTarget =
      isYachtOwner ||
      (!protectedTargetPosition &&
        canAssignToCrew(
          actorPosition,
          actorDepartment,
          targetPosition.title,
          targetDepartment,
          accountRole,
        ) &&
        canInviteCrew(
          actorPosition,
          actorDepartment,
          targetPosition.title,
          targetDepartment,
          accountRole,
        ));

    if (!canAssignTarget) {
      return jsonResponse(
        {
          ok: false,
          error: "You can only assign checklists within your yacht hierarchy.",
        },
        403,
      );
    }

    if (
      !canAssignChecklistDepartment(
        actorPosition,
        actorDepartment,
        validation.value.department,
        accountRole,
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error: `${validation.value.department} is outside your checklist authority.`,
        },
        403,
      );
    }

    const checklistPayload = {
      yacht_id: yachtId,
      created_by: user.id,
      title: validation.value.title,
      department: validation.value.department,
      checklist_type: validation.value.checklistType,
      frequency: validation.value.frequency,
      captain_note: validation.value.captainNote,
      assigned_to: targetMembership.crew_profile_id,
      due_date: validation.value.dueDate,
      status: "open",
      items: {
        frequency: validation.value.frequency,
        captain_note: validation.value.captainNote,
        tasks: validation.value.tasks.map((task) => task.text),
        source_template: "manual",
        summary: "Manual BlueDeck checklist created onboard.",
      },
    };
    const checklistResult = await insertChecklist(admin, checklistPayload);

    if (checklistResult.error || !checklistResult.data?.id) {
      return databaseError(
        "Checklist could not be created.",
        checklistResult.error,
      );
    }

    const checklistId = String(checklistResult.data.id);
    const itemResult = await insertChecklistItems(
      admin,
      checklistId,
      validation.value.tasks,
    );

    if (itemResult.error) {
      await cleanupPartialChecklist(admin, checklistId, yachtId);
      return databaseError(
        "Checklist tasks could not be created. No assignment was saved.",
        itemResult.error,
      );
    }

    return jsonResponse(
      {
        ok: true,
        checklist: {
          id: checklistId,
          assigned_to: targetMembership.crew_profile_id,
          task_count: validation.value.tasks.length,
          items: itemResult.itemIds.map((itemId: string, index: number) => ({
            id: itemId,
            task_index: index,
          })),
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return jsonResponse({ ok: false, error: error.message }, error.status);
    }

    console.error("Checklist creation failed.", error);
    return jsonResponse(
      { ok: false, error: "Checklist could not be created right now." },
      500,
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: yachtIdValue } = await context.params;
    const yachtId = yachtIdValue.trim().toLowerCase();
    if (!isUuid(yachtId)) {
      return jsonResponse({ ok: false, error: "Select a valid yacht." }, 400);
    }

    const { user } = await requireRequestUser(request);
    let body: ChecklistDeleteRequest;
    try {
      body = (await request.json()) as ChecklistDeleteRequest;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid checklist rollback request." }, 400);
    }

    const checklistId = cleanSingleLine(body.checklistId).toLowerCase();
    if (!isUuid(checklistId)) {
      return jsonResponse({ ok: false, error: "Select a valid checklist." }, 400);
    }

    const admin = getSupabaseAdmin();
    let checklistResult = await admin
      .from("yacht_checklists")
      .select("id,yacht_id,created_by,status")
      .eq("id", checklistId)
      .eq("yacht_id", yachtId)
      .maybeSingle();

    if (isSchemaCacheError(checklistResult.error)) {
      checklistResult = await admin
        .from("yacht_checklists")
        .select("id,yacht_id,status")
        .eq("id", checklistId)
        .eq("yacht_id", yachtId)
        .maybeSingle() as typeof checklistResult;
    }

    if (checklistResult.error) {
      return databaseError(
        "Checklist rollback access could not be verified.",
        checklistResult.error,
      );
    }
    if (!checklistResult.data) {
      return jsonResponse({ ok: true, alreadyRemoved: true });
    }
    if (normalizeStatus(checklistResult.data.status) !== "open") {
      return jsonResponse(
        { ok: false, error: "Only a newly created open checklist can be rolled back." },
        409,
      );
    }

    const yachtResult = await admin
      .from("yachts")
      .select("owner_id")
      .eq("id", yachtId)
      .maybeSingle();
    if (yachtResult.error) {
      return databaseError(
        "Checklist rollback authority could not be verified.",
        yachtResult.error,
      );
    }

    const createdBy =
      "created_by" in checklistResult.data
        ? String(checklistResult.data.created_by || "")
        : "";
    const isYachtOwner = yachtResult.data?.owner_id === user.id;
    if (!isYachtOwner) {
      if (createdBy !== user.id) {
        return jsonResponse(
          { ok: false, error: "Only the checklist creator can roll back this assignment." },
          403,
        );
      }

      const actorProfileResult = await findActorProfile(admin, user.id);
      if (actorProfileResult.error) {
        return databaseError(
          "Checklist rollback authority could not be verified.",
          actorProfileResult.error,
        );
      }
      const actorMembershipResult = await findActorMembership(
        admin,
        yachtId,
        actorProfileResult.data?.id || "",
      );
      if (actorMembershipResult.error) {
        return databaseError(
          "Checklist rollback authority could not be verified.",
          actorMembershipResult.error,
        );
      }
      if (
        !actorMembershipResult.data ||
        normalizeStatus(actorMembershipResult.data.status) !== "active"
      ) {
        return jsonResponse(
          { ok: false, error: "An active yacht membership is required." },
          403,
        );
      }
    }

    const itemResult = await admin
      .from("yacht_checklist_items")
      .select("id")
      .eq("checklist_id", checklistId);
    if (itemResult.error) {
      return databaseError(
        "Checklist rollback tasks could not be resolved.",
        itemResult.error,
      );
    }

    const deletingResult = await admin
      .from("yacht_checklists")
      .update({ status: "deleting" })
      .eq("id", checklistId)
      .eq("yacht_id", yachtId)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (deletingResult.error || !deletingResult.data) {
      return jsonResponse(
        { ok: false, error: "Checklist rollback could not be secured." },
        deletingResult.error ? 500 : 409,
      );
    }

    const itemIds = (itemResult.data || [])
      .map((item) => String(item.id || ""))
      .filter(isUuid);
    const itemCleanup = await admin
      .from("yacht_checklist_items")
      .delete()
      .eq("checklist_id", checklistId);
    const checklistCleanup = await admin
      .from("yacht_checklists")
      .delete()
      .eq("id", checklistId)
      .eq("yacht_id", yachtId);

    if (itemCleanup.error || checklistCleanup.error) {
      await admin
        .from("yacht_checklists")
        .update({ status: "open" })
        .eq("id", checklistId)
        .eq("yacht_id", yachtId)
        .eq("status", "deleting");
      return databaseError(
        "Checklist rollback could not be completed.",
        itemCleanup.error || checklistCleanup.error,
      );
    }

    await removeChecklistTaskPhotos(admin, yachtId, itemIds);
    return jsonResponse({ ok: true, removed: true });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return jsonResponse({ ok: false, error: error.message }, error.status);
    }

    console.error("Checklist rollback failed.", error);
    return jsonResponse(
      { ok: false, error: "Checklist rollback could not be completed." },
      500,
    );
  }
}

function validateChecklistRequest(
  body: ChecklistRequest,
  yachtId: string,
): ValidationResult {
  const membershipId = cleanSingleLine(body.membershipId).toLowerCase();
  if (!isUuid(membershipId)) {
    return { ok: false, error: "Select a valid crew member." };
  }

  const title = cleanSingleLine(body.title);
  if (title.length < 3 || title.length > maximumTitleLength) {
    return {
      ok: false,
      error: `Checklist title must be between 3 and ${maximumTitleLength} characters.`,
    };
  }

  const department = normalizeDepartment(body.department);
  if (!department) {
    return { ok: false, error: "Select a valid checklist department." };
  }

  const checklistType = cleanSingleLine(body.checklistType);
  if (
    checklistType.length < 2 ||
    checklistType.length > maximumChecklistTypeLength
  ) {
    return {
      ok: false,
      error: `Checklist type must be between 2 and ${maximumChecklistTypeLength} characters.`,
    };
  }

  const frequency = normalizeFrequency(body.frequency);
  if (!frequency || frequency === "Template default") {
    return { ok: false, error: "Select a valid checklist frequency." };
  }

  const dueDateResult = validateDueDate(body.dueDate);
  if (!dueDateResult.ok) {
    return { ok: false, error: dueDateResult.error };
  }

  const captainNoteResult = validateCaptainNote(body.captainNote);
  if (!captainNoteResult.ok) {
    return { ok: false, error: captainNoteResult.error };
  }

  if (!Array.isArray(body.tasks) || body.tasks.length < 1) {
    return { ok: false, error: "Add at least one checklist task." };
  }
  if (body.tasks.length > maximumTasks) {
    return {
      ok: false,
      error: `A checklist can contain up to ${maximumTasks} tasks.`,
    };
  }

  const tasks: ValidatedTask[] = [];
  for (let index = 0; index < body.tasks.length; index += 1) {
    const task = body.tasks[index];
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      return { ok: false, error: `Task ${index + 1} is invalid.` };
    }

    const source = task as Record<string, unknown>;
    const text = cleanSingleLine(source.text);
    if (text.length < 2 || text.length > maximumTaskTextLength) {
      return {
        ok: false,
        error: `Task ${index + 1} must be between 2 and ${maximumTaskTextLength} characters.`,
      };
    }

    const photoResult = validateTaskPhotoUrl(source.beforePhotoUrl, yachtId);
    if (!photoResult.ok) {
      return {
        ok: false,
        error: `Task ${index + 1}: ${photoResult.error}`,
      };
    }

    tasks.push({
      text,
      beforePhotoUrl: photoResult.value,
    });
  }

  return {
    ok: true,
    value: {
      membershipId,
      title,
      department,
      checklistType,
      frequency,
      dueDate: dueDateResult.value,
      captainNote: captainNoteResult.value,
      tasks,
    },
  };
}

function validateDueDate(
  value: unknown,
):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Due date is invalid." };
  }

  const dueDate = value.trim();
  const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { ok: false, error: "Due date must use YYYY-MM-DD format." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { ok: false, error: "Due date is invalid." };
  }

  return { ok: true, value: dueDate };
}

function validateCaptainNote(
  value: unknown,
):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Captain note is invalid." };
  }

  const captainNote = value.replace(/\r\n?/g, "\n").trim();
  if (captainNote.length > maximumCaptainNoteLength) {
    return {
      ok: false,
      error: `Captain note can contain up to ${maximumCaptainNoteLength} characters.`,
    };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(captainNote)) {
    return { ok: false, error: "Captain note contains unsupported characters." };
  }

  return { ok: true, value: captainNote || null };
}

function validateTaskPhotoUrl(
  value: unknown,
  yachtId: string,
):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "before photo is invalid." };
  }

  const photoUrl = value.trim();
  if (!photoUrl || photoUrl.length > maximumPhotoUrlLength) {
    return { ok: false, error: "before photo URL is invalid." };
  }

  try {
    const url = new URL(photoUrl);
    const configuredSupabaseOrigin = new URL(
      resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ).origin;
    const storageObject = parseSupabaseStorageObjectUrl(photoUrl);
    const pathSegments = storageObject?.path.split("/") || [];

    if (
      url.origin !== configuredSupabaseOrigin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      storageObject?.bucket !== "task-photos" ||
      !storageObject.path.startsWith(`${yachtId}/manual-checklist/`) ||
      pathSegments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return { ok: false, error: "before photo must be a secure yacht task photo." };
    }
  } catch {
    return { ok: false, error: "before photo URL is invalid." };
  }

  return { ok: true, value: photoUrl };
}

async function findActorProfile(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
) {
  return admin
    .from("crew_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
}

async function findActorMembership(
  admin: ReturnType<typeof getSupabaseAdmin>,
  yachtId: string,
  crewProfileId: string,
) {
  if (!crewProfileId) {
    return {
      data: null,
      error: null,
    };
  }

  return admin
    .from("yacht_crew_memberships")
    .select("crew_profile_id,position,department,status")
    .eq("yacht_id", yachtId)
    .eq("crew_profile_id", crewProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function insertChecklist(
  admin: ReturnType<typeof getSupabaseAdmin>,
  payload: Record<string, unknown>,
) {
  const optionalColumnSets = [
    [] as string[],
    ["captain_note"],
    ["frequency"],
    ["frequency", "captain_note"],
    ["items"],
    ["items", "captain_note"],
    ["items", "frequency"],
    ["items", "frequency", "captain_note"],
    ["items", "due_date"],
    ["items", "due_date", "status"],
    ["items", "frequency", "captain_note", "due_date"],
    ["items", "frequency", "captain_note", "due_date", "status"],
  ];
  const variants = optionalColumnSets.flatMap((keys) => {
    const fullPayload = keys.length ? omitKeys(payload, keys) : payload;
    return [fullPayload, omitKeys(fullPayload, ["created_by"])];
  });

  let lastResponse: { data: any; error: any } | null = null;

  for (const variant of variants) {
    const response = await admin
      .from("yacht_checklists")
      .insert(variant)
      .select()
      .single();

    if (!response.error) return response;
    lastResponse = response;
    if (!isSchemaCacheError(response.error)) return response;
  }

  return (
    lastResponse || {
      data: null,
      error: new Error("Checklist database is unavailable."),
    }
  );
}

async function insertChecklistItems(
  admin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  tasks: ValidatedTask[],
) {
  const preparedTasks = tasks.map((task) => ({
    ...task,
    id: crypto.randomUUID(),
  }));
  const baseTasks = preparedTasks.map((task) => ({
    id: task.id,
    checklist_id: checklistId,
    task_text: task.text,
    completed: false,
  }));
  const hasCaptainPhotos = tasks.some((task) => Boolean(task.beforePhotoUrl));
  const noteTasks = preparedTasks.map((task) => ({
    id: task.id,
    checklist_id: checklistId,
    task_text: task.text,
    completed: false,
    ...(task.beforePhotoUrl
      ? { note: JSON.stringify({ before_photo_url: task.beforePhotoUrl }) }
      : {}),
  }));
  const columnTasks = preparedTasks.map((task) => ({
    id: task.id,
    checklist_id: checklistId,
    task_text: task.text,
    completed: false,
    ...(task.beforePhotoUrl ? { before_photo_url: task.beforePhotoUrl } : {}),
  }));
  const variants = hasCaptainPhotos
    ? [
        noteTasks,
        noteTasks.map((task) => omitKeys(task, ["completed"])),
        columnTasks,
        columnTasks.map((task) => omitKeys(task, ["completed"])),
      ]
    : [
        baseTasks,
        baseTasks.map((task) => omitKeys(task, ["completed"])),
      ];

  let lastResponse: { data: any; error: any } | null = null;

  for (const variant of variants) {
    const response = await admin
      .from("yacht_checklist_items")
      .insert(variant)
      .select("id");
    if (!response.error) {
      return {
        ...response,
        itemIds: baseTasks.map((task) => task.id),
      };
    }
    lastResponse = response;
    if (!isSchemaCacheError(response.error)) {
      return { ...response, itemIds: [] as string[] };
    }
  }

  return {
    ...(lastResponse || {
      data: null,
      error: new Error("Checklist task database is unavailable."),
    }),
    itemIds: [] as string[],
  };
}

async function cleanupPartialChecklist(
  admin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  yachtId: string,
) {
  const itemCleanup = await admin
    .from("yacht_checklist_items")
    .delete()
    .eq("checklist_id", checklistId);
  const checklistCleanup = await admin
    .from("yacht_checklists")
    .delete()
    .eq("id", checklistId)
    .eq("yacht_id", yachtId);

  if (itemCleanup.error || checklistCleanup.error) {
    console.error("Partial checklist cleanup failed.", {
      checklistId,
      itemError: itemCleanup.error,
      checklistError: checklistCleanup.error,
    });
  }
}

async function removeChecklistTaskPhotos(
  admin: ReturnType<typeof getSupabaseAdmin>,
  yachtId: string,
  itemIds: string[],
) {
  for (const itemId of itemIds) {
    const prefix = `${yachtId}/${itemId}`;
    const listed = await admin.storage.from("task-photos").list(prefix, {
      limit: 100,
    });

    if (listed.error) {
      console.error("Checklist task-photo cleanup could not list objects.", {
        yachtId,
        itemId,
        error: listed.error,
      });
      continue;
    }

    const paths = (listed.data || [])
      .filter((item) => item.name)
      .map((item) => `${prefix}/${item.name}`);
    if (!paths.length) continue;

    const removed = await admin.storage.from("task-photos").remove(paths);
    if (removed.error) {
      console.error("Checklist task-photo cleanup could not remove objects.", {
        yachtId,
        itemId,
        error: removed.error,
      });
    }
  }
}

function cleanSingleLine(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeDepartment(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return (
    yachtDepartments.find(
      (department) => department.toLowerCase() === normalized,
    ) || ""
  );
}

function normalizeFrequency(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return (
    checklistFrequencies.find(
      (frequency) => frequency.toLowerCase() === normalized,
    ) || ""
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function omitKeys<T extends Record<string, unknown>>(value: T, keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
}

function isSchemaCacheError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    /schema cache|column/i.test(error.message || "")
  );
}

function databaseError(message: string, error: unknown) {
  console.error(message, error);
  return jsonResponse({ ok: false, error: message }, 500);
}

function jsonResponse(
  payload: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(payload, {
    status,
    headers: noStoreHeaders,
  });
}
