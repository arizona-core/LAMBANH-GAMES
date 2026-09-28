import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getIngredients, getInventoryMap, requirePlayer } from "@/lib/game/queries";
import { MarketView, type SellOption } from "./MarketView";

export const metadata: Metadata = { title: "Chợ" };

export default async function MarketPage() {
  const { supabase, profile } = await requirePlayer();
  const [feed, mine, ingredients, inventory] = await Promise.all([
    supabase.from("market_feed").select("*").neq("seller_id", profile.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("market_listings").select("*").eq("seller_id", profile.id).order("created_at", { ascending: false }).limit(30),
    getIngredients(supabase),
    getInventoryMap(supabase),
  ]);

  // Chợ chỉ bán nguyên liệu (kể cả sốt/topping); bánh luôn làm theo đơn khách.
  const sellOptions: SellOption[] = ingredients
    .filter((i) => (inventory[i.code] ?? 0) > 0)
    .map((i) => ({ item: i.code, name: i.name, image: i.image, have: inventory[i.code] ?? 0, refPrice: i.price }));

  const itemNames: Record<string, { name: string; image: string | null }> = Object.fromEntries(
    ingredients.map((i) => [i.code, { name: i.name, image: i.image }]),
  );

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Chợ" coins={profile.coins} />
        <MarketView
          level={profile.level}
          accountCreatedAt={profile.created_at}
          coins={profile.coins}
          feed={feed.data ?? []}
          mine={mine.data ?? []}
          sellOptions={sellOptions}
          itemNames={itemNames}
        />
      </div>
      <BottomNav />
    </main>
  );
}
