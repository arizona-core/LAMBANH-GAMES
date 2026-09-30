import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { avatarPhotoUrl } from "@/lib/game/avatar";
import { AVATAR_PHOTOS, type Avatar } from "@/lib/game/constants";
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
          activeTheme={profile.active_theme}
          chefImage={profile.avatar === "custom" ? avatarPhotoUrl(profile.avatar_url) : (AVATAR_PHOTOS[profile.avatar as Avatar] ?? null)}
        />
      </div>
      <BottomNav />
    </main>
  );
}
