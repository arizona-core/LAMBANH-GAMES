import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { Hud } from "@/components/Hud";
import { avatarPhotoUrl } from "@/lib/game/avatar";
import { AVATAR_PHOTOS, type Avatar } from "@/lib/game/constants";
import { todayVN } from "@/lib/game/format";
import { countOnline, requirePlayer } from "@/lib/game/queries";
import { ShopScene } from "./ShopScene";

export const metadata: Metadata = { title: "Tiệm" };

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const { supabase, profile } = await requirePlayer();
  const [params, { data: owned }, { data: reviews }, online] = await Promise.all([
    searchParams,
    supabase.from("upgrades").select("upgrade_code"),
    supabase.from("reviews").select("stars"),
    countOnline(supabase),
  ]);
  const decor = (owned ?? []).map((u) => u.upgrade_code);
  const total = reviews?.length ?? 0;
  const avg = total ? (reviews ?? []).reduce((s, r) => s + r.stars, 0) / total : 0;
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
          theme={profile.active_theme}
          chefImage={profile.avatar === "custom" ? avatarPhotoUrl(profile.avatar_url) : (AVATAR_PHOTOS[profile.avatar as Avatar] ?? null)}
          onlineCount={Math.max(1, online)}
          reviewSummary={{ avg, total }}
          shopOpen={profile.shop_open}
        />
      </div>
      <BottomNav />
    </main>
  );
}
