import { permanentRedirect } from "next/navigation";

export default function LegacyGuidesPage() {
  permanentRedirect("/blog");
}
