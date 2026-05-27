import { redirect } from "next/navigation";

export default async function YachtChecklistsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/yachts/${id}/crew`);
}
