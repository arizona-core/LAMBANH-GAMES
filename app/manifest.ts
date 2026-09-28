import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sweet Shop — Tiệm bánh online",
    short_name: "Sweet Shop",
    description: "Làm bánh, bán bánh, đua top cùng người chơi thật.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBEFDD",
    theme_color: "#FBEFDD",
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
