import type { SupabaseClient } from "@supabase/supabase-js";

export type CrewChecklistCompletion = {
  id: string;
  status: "completed";
  completed_at: string;
  updated_at?: string;
};

const unconfirmedUpdate = "Checklist completion could not be confirmed. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function isSchemaCacheError(error: unknown) {
  if (!isRecord(error)) return false;
  return [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
    .includes("schema cache");
}

function updateError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(
    isRecord(error) && typeof error.message === "string" ? error.message : unconfirmedUpdate,
    { cause: error },
  );
}

function confirmedCompletion(value: unknown, checklistId: string): CrewChecklistCompletion {
  if (!isRecord(value) || value.id !== checklistId || value.status !== "completed") {
    throw new Error(unconfirmedUpdate);
  }

  if (value.updated_at != null && !isValidTimestamp(value.updated_at)) {
    throw new Error(unconfirmedUpdate);
  }

  // Older schemas can omit completed_at. Only their server-returned update
  // timestamp may substitute for it; never use the submitted client clock.
  const completedAt = Object.prototype.hasOwnProperty.call(value, "completed_at")
    ? value.completed_at
    : value.updated_at;
  if (!isValidTimestamp(completedAt)) throw new Error(unconfirmedUpdate);

  const result: CrewChecklistCompletion = {
    id: checklistId,
    status: "completed",
    completed_at: completedAt,
  };
  if (isValidTimestamp(value.updated_at)) result.updated_at = value.updated_at;
  return result;
}

export async function saveCrewChecklistCompletion(
  client: Pick<SupabaseClient, "from">,
  checklistId: string,
): Promise<CrewChecklistCompletion> {
  const payloads = [
    { status: "completed", completed_at: new Date().toISOString() },
    { status: "completed" },
  ];

  for (const [index, payload] of payloads.entries()) {
    const response = await client
      .from("yacht_checklists")
      .update(payload)
      .eq("id", checklistId)
      .select("*")
      .maybeSingle();

    if (response.error) {
      if (index === 0 && isSchemaCacheError(response.error)) continue;
      throw updateError(response.error);
    }

    return confirmedCompletion(response.data, checklistId);
  }

  throw new Error(unconfirmedUpdate);
}
