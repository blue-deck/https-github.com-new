import { NextResponse } from "next/server";
import {
  RequestAuthError,
  requireRequestUser,
} from "@/app/lib/server/auth";
import { getSupabaseAdmin } from "@/app/lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ACTIVE_APPLICATION_STATUSES = [
  "applied",
  "viewed",
  "shortlisted",
  "interview",
  "reference_check",
  "offer",
] as const;

const TERMINAL_APPLICATION_STATUSES = [
  "hired",
  "rejected",
  "withdrawn",
] as const;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireRequestUser(request);
    const { id } = await context.params;

    if (!isUuid(id)) {
      return apiError(
        400,
        "INVALID_APPLICATION_ID",
        "Invalid application identifier.",
      );
    }

    const body = (await request.json()) as { status?: unknown };
    if (body.status !== "withdrawn") {
      return apiError(
        400,
        "INVALID_APPLICATION_STATUS",
        "This endpoint only accepts a withdrawn status.",
      );
    }

    const admin = getSupabaseAdmin();
    const applicationResult = await admin
      .from("job_applications")
      .select("id,status,applicant_user_id")
      .eq("id", id)
      .eq("applicant_user_id", user.id)
      .maybeSingle();

    if (applicationResult.error) {
      if (isSchemaUnavailable(applicationResult.error)) {
        return applicationsUnavailable();
      }
      console.error("[applications/withdraw] Candidate lookup failed", {
        code: applicationResult.error.code,
        applicationId: id,
        userId: user.id,
      });
      return apiError(
        500,
        "APPLICATION_WITHDRAWAL_FAILED",
        "The application could not be withdrawn.",
      );
    }

    if (!applicationResult.data) {
      return apiError(
        404,
        "APPLICATION_NOT_FOUND",
        "Application not found.",
      );
    }

    const currentStatus = normalizeStatus(applicationResult.data.status);
    if (
      TERMINAL_APPLICATION_STATUSES.includes(
        currentStatus as (typeof TERMINAL_APPLICATION_STATUSES)[number],
      )
    ) {
      return apiError(
        409,
        "APPLICATION_ALREADY_FINAL",
        currentStatus === "withdrawn"
          ? "This application has already been withdrawn."
          : "This application has reached a final status and cannot be withdrawn.",
      );
    }
    if (
      !ACTIVE_APPLICATION_STATUSES.includes(
        currentStatus as (typeof ACTIVE_APPLICATION_STATUSES)[number],
      )
    ) {
      return apiError(
        409,
        "APPLICATION_NOT_ACTIVE",
        "Only an active application can be withdrawn.",
      );
    }

    const updateResult = await admin
      .from("job_applications")
      .update({ status: "withdrawn" })
      .eq("id", id)
      .eq("applicant_user_id", user.id)
      .in("status", [...ACTIVE_APPLICATION_STATUSES])
      .select("id,status,withdrawn_at,updated_at")
      .maybeSingle();

    if (updateResult.error) {
      if (isSchemaUnavailable(updateResult.error)) {
        return applicationsUnavailable();
      }
      console.error("[applications/withdraw] Explicit update failed", {
        code: updateResult.error.code,
        applicationId: id,
        userId: user.id,
      });
      return apiError(
        500,
        "APPLICATION_WITHDRAWAL_FAILED",
        "The application could not be withdrawn.",
      );
    }

    if (!updateResult.data) {
      return apiError(
        409,
        "APPLICATION_STATUS_CHANGED",
        "The application status changed before withdrawal. Refresh and try again.",
      );
    }

    return NextResponse.json(
      {
        ok: true,
        available: true,
        application: updateResult.data,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return apiError(error.status, "AUTH_REQUIRED", error.message);
    }
    if (error instanceof SyntaxError) {
      return apiError(
        400,
        "INVALID_WITHDRAWAL_REQUEST",
        "Invalid application withdrawal request.",
      );
    }
    if (
      error instanceof Error &&
      /server credentials are not configured/i.test(error.message)
    ) {
      return applicationsUnavailable();
    }

    console.error("[applications/withdraw] Unexpected route failure", error);
    return apiError(
      500,
      "APPLICATION_WITHDRAWAL_FAILED",
      "The application could not be withdrawn.",
    );
  }
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function applicationsUnavailable(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      available: false,
      error: "The protected applications service is not available yet.",
      errorCode: "JOBS_UNAVAILABLE",
    },
    { status: 503, headers: noStoreHeaders },
  );
}

function apiError(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      available: true,
      error: message,
      errorCode: code,
    },
    { status, headers: noStoreHeaders },
  );
}

function isSchemaUnavailable(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(
      error.code || "",
    ) ||
    /schema cache|does not exist|could not find/i.test(error.message || "")
  );
}

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};
