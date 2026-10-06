import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { requirePlayer } from "@/lib/game/queries";
import { LixiView } from "./LixiView";

export const metadata: Metadata = { title: "Lì xì" };

export default async function LixiPage() {
  const { profile } = await requirePlayer();

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Lì xì" coins={profile.coins} gems={profile.gems} />
        <LixiView />
      </div>
      <BottomNav />
    </main>
  );
}
