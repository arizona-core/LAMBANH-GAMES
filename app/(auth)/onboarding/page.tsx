import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Mở tiệm" };

export default async function OnboardingPage() {
  const { user, profile } = await getCurrentPlayer();
  if (!user) redirect("/login");
  if (profile) redirect("/shop");

  const suggested = (user.user_metadata?.full_name as string | undefined)?.slice(0, 24) ?? "";
  return (
    <main className="app">
      <div className="screen" style={{ gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Mở tiệm của bạn</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontWeight: 700 }}>
            Đặt tên và trang trí để bắt đầu
          </p>
        </div>
        <OnboardingForm suggestedOwner={suggested} />
      </div>
    </main>
  );
}
