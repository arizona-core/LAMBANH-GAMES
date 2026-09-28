import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getUpgradeBonuses, requirePlayer } from "@/lib/game/queries";
import { StoreView } from "./StoreView";

export const metadata: Metadata = { title: "Cửa hàng" };

export default async function StorePage() {
  const { supabase, profile } = await requirePlayer();
  const [{ data: catalog }, bonuses] = await Promise.all([
    supabase.from("upgrade_catalog").select("*").order("sort"),
    getUpgradeBonuses(supabase),
  ]);

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Cửa hàng" coins={profile.coins} gems={profile.gems} />
        <StoreView
          catalog={catalog ?? []}
          owned={[...bonuses.owned]}
          level={profile.level}
          coins={profile.coins}
          gems={profile.gems}
        />
      </div>
      <BottomNav />
    </main>
  );
}
