import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getIngredients, getInventoryMap, getRecipes, requirePlayer } from "@/lib/game/queries";
import { KitchenView } from "./KitchenView";

export const metadata: Metadata = { title: "Bếp" };

export default async function KitchenPage({ searchParams }: PageProps<"/kitchen">) {
  const { supabase, profile } = await requirePlayer();
  const [recipes, ingredients, inventory, params] = await Promise.all([
    getRecipes(supabase),
    getIngredients(supabase),
    getInventoryMap(supabase),
    searchParams,
  ]);

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Bếp bánh" coins={profile.coins} />
        <KitchenView
          level={profile.level}
          coins={profile.coins}
          recipes={recipes}
          ingredients={ingredients}
          inventory={inventory}
          initialTab={params.tab === "pantry" ? "pantry" : "recipes"}
        />
      </div>
      <BottomNav />
    </main>
  );
}
