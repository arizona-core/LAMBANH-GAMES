import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// Fredoka (bản thiết kế) không có bộ chữ tiếng Việt → dùng Baloo 2 cho tiêu đề (tròn, có dấu đầy đủ).
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
});

// Nunito là variable font → 1 file cho mọi độ đậm.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: { default: "Sweet Shop", template: "%s · Sweet Shop" },
  description: "Làm bánh, bán bánh, đua top cùng người chơi thật.",
  applicationName: "Sweet Shop",
  appleWebApp: { capable: true, title: "Sweet Shop", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FBEFDD",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${baloo.variable} ${nunito.variable}`}>
      <body>
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
