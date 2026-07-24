import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ChecklistRow = Record<string, unknown>;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: noStoreHeaders,
  });
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret?.trim()) return false;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFrequency(checklist: ChecklistRow) {
  const items = isRecord(checklist.items) ? checklist.items : null;
  return getString(checklist.frequency) || getString(items?.frequency);
}

function isRecurringFrequency(frequency?: string) {
  return ["daily", "weekly", "monthly"].includes((frequency || "").toLowerCase());
}

function getRecurringSignature(checklist: ChecklistRow, frequency: string) {
  const checklistId = getString(checklist.id);
  const assignedTo = getString(checklist.assigned_to);
  const yachtId = getString(checklist.yacht_id);
  const title = getString(checklist.title);

  if (!checklistId || !assignedTo || !yachtId || !title) return "";

  return [
    assignedTo,
    yachtId,
    title,
    getString(checklist.department),
    getString(checklist.checklist_type),
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(
      { ok: false, error: "Checklist renewal is unavailable." },
      503
    );
  }

  try {
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
      console.error("Recurring checklist lookup failed", error);
      return jsonResponse({ ok: false, error: "Checklist renewal failed." }, 500);
    }

    const sourceBySignature = new Map<string, ChecklistRow>();
    const currentPeriodSignatures = new Set<string>();

    (Array.isArray(checklists) ? checklists : [])
      .filter(isRecord)
      .forEach((checklist) => {
        const frequency = getFrequency(checklist);
        const createdAt = getString(checklist.created_at);

        if (!isRecurringFrequency(frequency) || !createdAt) return;

        const signature = getRecurringSignature(checklist, frequency);
        if (!signature) return;

        if (!sourceBySignature.has(signature)) {
          sourceBySignature.set(signature, checklist);
        }

        if (getPeriodKey(createdAt, frequency) === getPeriodKey(now.toISOString(), frequency)) {
          currentPeriodSignatures.add(signature);
        }
      });

    let created = 0;
    let skipped = currentPeriodSignatures.size;
    const failures: string[] = [];

    for (const [signature, source] of sourceBySignature.entries()) {
      const frequency = getFrequency(source);
      if (currentPeriodSignatures.has(signature)) continue;

      const periodKey = getPeriodKey(now.toISOString(), frequency);
      const { data, error: renewalError } = await supabase.rpc(
        "bluedeck_create_recurring_checklist",
        {
          p_source_id: getString(source.id),
          p_period_key: periodKey,
          p_due_date: now.toISOString().slice(0, 10),
        },
      );
      const renewal = isRecord(data) ? data : {};

      if (renewalError || renewal.ok !== true) {
        console.error("Recurring checklist renewal RPC failed", renewalError);
        failures.push(signature);
        continue;
      }

      if (renewal.created === true) {
        created += 1;
      } else {
        skipped += 1;
      }
    }

    return jsonResponse({
      ok: true,
      created,
      skipped,
      failures: failures.length,
      renewedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Recurring checklist renewal failed", error);
    return jsonResponse({ ok: false, error: "Checklist renewal failed." }, 500);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
