import type { Metadata } from "next";
import { GuidesLibrary } from "./_components/GuidesLibrary";
import { guideBase, guideSummaries as guides } from "./_components/guide-index";

const title = "Yat Kariyeri Rehberleri | BlueDeck Journal";
const description = "İlk yat işine başvuru, crew CV hazırlama ve teknede yaşam için pratik rehberler. Yat kariyerindeki bir sonraki adımına BlueDeck ile hazırlan.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: guideBase },
  openGraph: {
    title, description, url: guideBase, siteName: "BlueDeck", locale: "tr_TR", type: "website",
    images: [{ url: guides[0].image, width: 1440, height: 960, alt: guides[0].imageAlt }],
  },
  twitter: { card: "summary_large_image", title, description, images: [guides[0].image] },
};

export default function GuidesPage() {
  return <GuidesLibrary />;
}
