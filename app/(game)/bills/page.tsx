import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { requirePlayer } from "@/lib/game/queries";
import { BillsView } from "./BillsView";

export const metadata: Metadata = { title: "Chi phí & thuế" };

export default async function BillsPage() {
  const { profile } = await requirePlayer();

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Chi phí & thuế" coins={profile.coins} />
        <BillsView />
      </div>
      <BottomNav />
    </main>
  );
}
