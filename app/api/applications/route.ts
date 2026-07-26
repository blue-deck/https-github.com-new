import { NextRequest } from "next/server";
import {
  accountRole,
  applicationResponse,
  authenticatedApplicationClients,
} from "../../lib/jobApplicationsServer";
import { listOwnJobApplications } from "../../lib/myJobApplicationsServer";
import { isMarketplaceAccountRole } from "../../lib/marketplaceCapabilities";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const roleResult = await accountRole(
    clients.serviceClient,
    clients.user.id,
  );
  if (!roleResult.ok || !isMarketplaceAccountRole(roleResult.role)) {
    return applicationResponse(
      { ok: false, error: "Application access could not be verified." },
      503,
    );
  }

  const eligible = roleResult.role === "crew" || roleResult.role === "captain";
  if (!eligible) {
    return applicationResponse({
      ok: true,
      role: roleResult.role,
      eligible: false,
      applications: [],
    });
  }

  const result = await listOwnJobApplications(
    clients.serviceClient,
    clients.user.id,
  );
  if (!result.ok) {
    return applicationResponse({ ok: false, error: result.error }, 500);
  }

  return applicationResponse({
    ok: true,
    role: roleResult.role,
    eligible: true,
    applications: result.applications,
  });
}
