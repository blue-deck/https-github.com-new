import type { MetadataRoute } from "next";

// Keep this revision aligned with public/sw.js when PWA brand assets change.
const pwaAssetRevision = "2026-08-01-1";
const versionedAsset = (path: string) => `${path}?v=${pwaAssetRevision}`;
const appIcon = versionedAsset("/app-icon-192.png");

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BlueDeck YACHT-OS",
    short_name: "BlueDeck",
    description: "Enterprise superyacht operations for owners, captains and crew.",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "en",
    dir: "ltr",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f5fbff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: appIcon,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: versionedAsset("/app-icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: versionedAsset("/app-icon-maskable-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: versionedAsset("/app-icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open your BlueDeck dashboard.",
        url: "/dashboard",
        icons: [{ src: appIcon, sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
