import type { MetadataRoute } from "next";

const appIcon = "/app-icon-192.png";

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
    theme_color: "#071631",
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
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/app-icon-maskable-512.png",
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
