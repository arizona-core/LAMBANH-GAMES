import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { Hud } from "@/components/Hud";
import { todayVN } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import { ShopScene } from "./ShopScene";

export const metadata: Metadata = { title: "Tiệm" };

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const { profile } = await requirePlayer();
  const params = await searchParams;
  const today = todayVN();

  return (
    <main className="app app--warm">
      <div className="screen screen--with-nav">
        <Hud profile={profile} />
        <ShopScene
          revenueToday={profile.revenue_day === today ? profile.revenue_today : 0}
          canClaimDaily={profile.last_checkin !== today}
          welcome={params.welcome === "1"}
        />
      </div>
      <BottomNav />
    </main>
  );
}
