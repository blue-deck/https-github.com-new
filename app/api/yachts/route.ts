import { getYachtWorkspace, saveYachtWorkspace } from "../../lib/yachtWorkspaceServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return getYachtWorkspace(request);
}

export async function POST(request: Request) {
  return saveYachtWorkspace(request);
}
