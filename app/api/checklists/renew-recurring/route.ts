import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ChecklistRow = Record<string, any>;

type CronAuthorization = "authorized" | "unauthorized" | "unconfigured";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: noStoreHeaders,
  });
}

function getCronAuthorization(request: NextRequest): CronAuthorization {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret?.trim()) {
    return process.env.NODE_ENV === "production" ? "unconfigured" : "authorized";
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`
    ? "authorized"
    : "unauthorized";
}

function getFrequency(checklist: ChecklistRow) {
  return checklist?.frequency || checklist?.items?.frequency || "";
}

function getCaptainNote(checklist: ChecklistRow) {
  return checklist?.captain_note || checklist?.items?.captain_note || "";
}

function isRecurringFrequency(frequency?: string) {
  return ["daily", "weekly", "monthly"].includes((frequency || "").toLowerCase());
}

function getRecurringSignature(checklist: ChecklistRow, frequency: string) {
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

function omitKeys<T extends Record<string, unknown>>(value: T, keys: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function isSchemaCacheError(error: any) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return text.includes("schema cache") || text.includes("column");
}

async function insertChecklist(supabase: any, payload: Record<string, any>) {
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

export async function GET(request: NextRequest) {
  const authorization = getCronAuthorization(request);

  if (authorization === "unconfigured") {
    return jsonResponse(
      { ok: false, error: "Cron authentication is not configured." },
      503
    );
  }

  if (authorization === "unauthorized") {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ ok: false, error: "Supabase is not configured." }, 500);
  }

  const supabase = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const now = new Date();
  const { data: checklists, error } = await supabase
    .from("yacht_checklists")
    .select("*, yacht_checklist_items (*)")
    .not("assigned_to", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  const sourceBySignature = new Map<string, ChecklistRow>();
  const currentPeriodSignatures = new Set<string>();

  (checklists || []).forEach((checklist: ChecklistRow) => {
    const frequency = getFrequency(checklist);
    if (!isRecurringFrequency(frequency)) return;

    const signature = getRecurringSignature(checklist, frequency);
    if (!signature) return;

    if (!sourceBySignature.has(signature)) {
      sourceBySignature.set(signature, checklist);
    }

    if (getPeriodKey(checklist.created_at, frequency) === getPeriodKey(now.toISOString(), frequency)) {
      currentPeriodSignatures.add(signature);
    }
  });

  let created = 0;
  const failures: string[] = [];

  for (const [signature, source] of sourceBySignature.entries()) {
    const frequency = getFrequency(source);
    if (currentPeriodSignatures.has(signature)) continue;

    const periodKey = getPeriodKey(now.toISOString(), frequency);
    const payload = {
      yacht_id: source.yacht_id,
      title: source.title,
      department: source.department,
      checklist_type: source.checklist_type,
      frequency,
      due_date: now.toISOString().slice(0, 10),
      captain_note: getCaptainNote(source) || null,
      assigned_to: source.assigned_to,
      status: "open",
      items: {
        ...(typeof source.items === "object" && source.items ? source.items : {}),
        frequency,
        captain_note: getCaptainNote(source) || null,
        recurring_from: source.id,
        recurring_period: periodKey,
      },
    };

    const { data: checklist, error: insertError } = await insertChecklist(supabase, payload);
    if (insertError || !checklist?.id) {
      failures.push(signature);
      continue;
    }

    const tasks = (source.yacht_checklist_items || [])
      .map((task: any) => (task.task_text || "").trim())
      .filter(Boolean);

    if (tasks.length) {
      await supabase.from("yacht_checklist_items").insert(
        tasks.map((task: string) => ({
          checklist_id: checklist.id,
          task_text: task,
          completed: false,
        }))
      );
    }

    created += 1;
  }

  return jsonResponse({
    ok: true,
    created,
    skipped: currentPeriodSignatures.size,
    failures: failures.length,
    renewedAt: now.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
