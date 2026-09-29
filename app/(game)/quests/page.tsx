import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { requirePlayer } from "@/lib/game/queries";
import { QuestsView } from "./QuestsView";

export const metadata: Metadata = { title: "Nhiệm vụ" };

export default async function QuestsPage() {
  const { profile } = await requirePlayer();

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Nhiệm vụ hôm nay" coins={profile.coins} gems={profile.gems} />
        <QuestsView />
      </div>
      <BottomNav />
    </main>
  );
}
