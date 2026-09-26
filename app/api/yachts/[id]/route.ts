import { saveYachtWorkspace } from "../../../lib/yachtWorkspaceServer";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return saveYachtWorkspace(request, (await context.params).id);
}
