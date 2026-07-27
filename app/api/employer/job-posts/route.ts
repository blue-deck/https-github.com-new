import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
} from "../../../lib/employerAccessServer";
import {
  employerJobPostFromRow,
  employerJobPostSelect,
  jobPostMutationColumns,
  loadJobPostingWorkspaceAuthority,
  logJobPostError,
  parseJobPostMutation,
  readJobPostBody,
  verifyJobPostingAuthority,
} from "../../../lib/jobPostsServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return employerResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const authority = await loadJobPostingWorkspaceAuthority(
    clients.serviceClient,
    clients.user.id,
  );
  if (!authority.ok) {
    return employerResponse(
      { ok: false, error: authority.error },
      authority.status,
    );
  }

  const { yachts, capabilities } = authority;

  if (yachts.length === 0) {
    return employerResponse({
      ok: true,
      capabilities,
      yachts: [],
      jobs: [],
      applicationCounts: {},
      applicationCountsAvailable: true,
    });
  }

  const { data, error } = await clients.serviceClient
    .from("job_posts")
    .select(employerJobPostSelect)
    .in(
      "yacht_id",
      yachts.map((yacht) => yacht.id),
    )
    .order("updated_at", { ascending: false })
    .limit(250);

  if (error) {
    logJobPostError("employer_job_listing_load_failed", error, {
      actorUserId: clients.user.id,
    });
    return employerResponse(
      { ok: false, error: "Your job posts could not be loaded." },
      500,
    );
  }

  const jobs = [];
  for (const row of data || []) {
    const job = employerJobPostFromRow(row);
    if (!job) {
      logJobPostError("invalid_employer_job_record", undefined, {
        actorUserId: clients.user.id,
        recordId:
          typeof row.id === "string" && row.id ? row.id : "unknown",
      });
      return employerResponse(
        { ok: false, error: "Your job posts could not be loaded." },
        500,
      );
    }
    jobs.push(job);
  }

  let applicationCounts: Record<string, number> = Object.fromEntries(
    jobs.map((job) => [job.id, 0]),
  );
  let applicationCountsAvailable = true;

  if (jobs.length > 0) {
    const authorizedJobIds = new Set(jobs.map((job) => job.id));

    try {
      const {
        data: applicationRows,
        error: applicationError,
        count: applicationRowCount,
      } = await clients.serviceClient
        .from("job_applications")
        .select("job_post_id", { count: "exact" })
        .in("job_post_id", [...authorizedJobIds])
        .limit(50_000);

      if (
        applicationError ||
        !Array.isArray(applicationRows) ||
        typeof applicationRowCount !== "number" ||
        applicationRows.length !== applicationRowCount
      ) {
        throw (
          applicationError ||
          new Error("The application count result was incomplete.")
        );
      }

      const nextCounts: Record<string, number> = Object.fromEntries(
        jobs.map((job) => [job.id, 0]),
      );

      for (const row of applicationRows) {
        const jobPostId = cleanText(row.job_post_id);
        if (!authorizedJobIds.has(jobPostId)) {
          throw new Error("The application count result was invalid.");
        }
        nextCounts[jobPostId] += 1;
      }

      applicationCounts = nextCounts;
    } catch (error) {
      applicationCounts = {};
      applicationCountsAvailable = false;
      logJobPostError("employer_job_application_counts_load_failed", error, {
        actorUserId: clients.user.id,
        jobPostCount: jobs.length,
      });
    }
  }

  return employerResponse({
    ok: true,
    capabilities,
    yachts,
    jobs,
    applicationCounts,
    applicationCountsAvailable,
  });
}

export async function POST(request: NextRequest) {
  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return employerResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const body = await readJobPostBody(request);
  if (!body.ok) {
    return employerResponse(
      { ok: false, error: body.error },
      body.status,
    );
  }

  const parsed = parseJobPostMutation(body.value, "create");
  if (!parsed.ok) {
    return employerResponse({ ok: false, error: parsed.error }, 400);
  }

  const authority = await verifyJobPostingAuthority(
    clients.serviceClient,
    clients.user.id,
    parsed.data.yachtId,
  );
  if (!authority.ok) {
    return employerResponse(
      { ok: false, error: authority.error },
      authority.status,
    );
  }

  const { data, error } = await clients.serviceClient
    .from("job_posts")
    .insert({
      id: crypto.randomUUID(),
      yacht_id: parsed.data.yachtId,
      created_by: clients.user.id,
      updated_by: clients.user.id,
      ...jobPostMutationColumns(parsed.data),
    })
    .select(employerJobPostSelect)
    .single();

  if (error) {
    const code = cleanText(error.code);
    logJobPostError("job_post_create_failed", error, {
      actorUserId: clients.user.id,
      yachtId: parsed.data.yachtId,
      forbidden: code === "42501",
    });
    return employerResponse(
      {
        ok: false,
        error:
          code === "42501"
            ? "Your yacht marketplace access changed before the job post was saved."
            : code === "23514"
              ? "The job post does not meet the publishing requirements."
              : "The job post could not be created.",
      },
      code === "42501" ? 403 : code === "23514" ? 400 : 500,
    );
  }

  const job = employerJobPostFromRow(data);
  if (!job) {
    logJobPostError("invalid_created_job_record", undefined, {
      actorUserId: clients.user.id,
      yachtId: parsed.data.yachtId,
    });
    return employerResponse(
      { ok: false, error: "The saved job post could not be loaded." },
      500,
    );
  }

  return employerResponse({ ok: true, job }, 201);
}

function employerResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Authorization",
    },
  });
}
