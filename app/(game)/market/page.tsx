import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getBakedGoods, getIngredients, getInventoryMap, getRecipes, requirePlayer } from "@/lib/game/queries";
import { QUALITY_PCT } from "@/lib/game/scoring";
import { MarketView, type SellOption } from "./MarketView";

export const metadata: Metadata = { title: "Chợ" };

export default async function MarketPage() {
  const { supabase, profile } = await requirePlayer();
  const [feed, mine, ingredients, recipes, inventory, goods] = await Promise.all([
    supabase.from("market_feed").select("*").neq("seller_id", profile.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("market_listings").select("*").eq("seller_id", profile.id).order("created_at", { ascending: false }).limit(30),
    getIngredients(supabase),
    getRecipes(supabase),
    getInventoryMap(supabase),
    getBakedGoods(supabase),
  ]);

  const sellOptions: SellOption[] = [
    ...ingredients
      .filter((i) => (inventory[i.code] ?? 0) > 0)
      .map((i) => ({
        key: `ingredient:${i.code}`,
        kind: "ingredient" as const,
        item: i.code,
        quality: null,
        name: i.name,
        image: i.image,
        have: inventory[i.code] ?? 0,
        refPrice: i.price,
      })),
    ...goods.map((g) => ({
      key: `baked:${g.recipe_code}:${g.quality}`,
      kind: "baked" as const,
      item: g.recipe_code,
      quality: g.quality,
      name: g.recipes?.name ?? g.recipe_code,
      image: g.recipes?.image ?? null,
      have: g.qty,
      refPrice: Math.floor(((g.recipes?.base_price ?? 0) * QUALITY_PCT[g.quality - 1]) / 100),
    })),
  ];

  const itemNames: Record<string, { name: string; image: string | null }> = {
    ...Object.fromEntries(ingredients.map((i) => [`ingredient:${i.code}`, { name: i.name, image: i.image }])),
    ...Object.fromEntries(recipes.map((r) => [`baked:${r.code}`, { name: r.name, image: r.image }])),
  };

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
