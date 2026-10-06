import type { SupabaseClient } from "@supabase/supabase-js";

export type CrewTaskCompletion = {
  id: string;
  completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
};

const unconfirmedUpdate = "The task update could not be confirmed. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSchemaCacheError(error: unknown) {
  if (!isRecord(error)) return false;
  const message = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return message.includes("schema cache");
}

function updateError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(
    isRecord(error) && typeof error.message === "string"
      ? error.message
      : unconfirmedUpdate,
    { cause: error },
  );
}

function confirmedCompletion(
  value: unknown,
  taskId: string,
  completed: boolean,
): CrewTaskCompletion {
  if (
    !isRecord(value) ||
    value.id !== taskId ||
    typeof value.completed !== "boolean" ||
    value.completed !== completed
  ) {
    throw new Error(unconfirmedUpdate);
  }

  const result: CrewTaskCompletion = { id: taskId, completed: value.completed };
  for (const field of ["completed_at", "completed_by"] as const) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
    const metadata = value[field];
    if (metadata !== null && typeof metadata !== "string") {
      throw new Error(unconfirmedUpdate);
    }
    result[field] = metadata;
  }
  return result;
}

export async function saveCrewTaskCompletion(
  client: Pick<SupabaseClient, "from">,
  taskId: string,
  completed: boolean,
  completedBy: string,
): Promise<CrewTaskCompletion> {
  const payloads = [
    {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? completedBy : null,
    },
    { completed },
  ];

  for (const [index, payload] of payloads.entries()) {
    const response = await client
      .from("yacht_checklist_items")
      .update(payload)
      .eq("id", taskId)
      .select("*")
      .maybeSingle();

    if (response.error) {
      if (index === 0 && isSchemaCacheError(response.error)) continue;
      throw updateError(response.error);
    }

    // Triggers own completion time and identity. Keep proof fields out of this
    // patch so callers preserve their existing signed photo references.
    return confirmedCompletion(response.data, taskId, completed);
  }

  throw new Error(unconfirmedUpdate);
}
