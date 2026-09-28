import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { Hud } from "@/components/Hud";
import { todayVN } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import { ShopScene } from "./ShopScene";

export const metadata: Metadata = { title: "Tiệm" };

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const { supabase, profile } = await requirePlayer();
  const [params, { data: owned }] = await Promise.all([
    searchParams,
    supabase.from("upgrades").select("upgrade_code, upgrade_catalog(name, image, scene_slot)"),
  ]);
  const decor = (owned ?? []).flatMap((u) =>
    u.upgrade_catalog?.scene_slot
      ? [{ code: u.upgrade_code, name: u.upgrade_catalog.name, image: u.upgrade_catalog.image, slot: u.upgrade_catalog.scene_slot }]
      : [],
  );
  const today = todayVN();

  return (
    <main className="app app--warm">
      <div className="screen screen--with-nav">
        <Hud profile={profile} />
        <ShopScene
          revenueToday={profile.revenue_day === today ? profile.revenue_today : 0}
          canClaimDaily={profile.last_checkin !== today}
          welcome={params.welcome === "1"}
          decor={decor}
        />
      </div>
      <BottomNav />
    </main>
  );
}
