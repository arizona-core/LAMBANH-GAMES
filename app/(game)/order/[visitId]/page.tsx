import type { Metadata } from "next";
import { recipeDifficulty, type CookMethod, type IngredientCategory, type Packaging } from "@/lib/game/orders";
import { getIngredients, getInventoryMap, getRecipes, requirePlayer } from "@/lib/game/queries";
import { OrderFlow } from "./OrderFlow";

export const metadata: Metadata = { title: "Làm đơn" };

export default async function OrderPage({ params }: PageProps<"/order/[visitId]">) {
  const { visitId } = await params;
  const { supabase, profile } = await requirePlayer();
  const [ingredients, inventory, recipes] = await Promise.all([
    getIngredients(supabase),
    getInventoryMap(supabase),
    getRecipes(supabase),
  ]);

  return (
    <main className="app app--oven">
      <OrderFlow
        visitId={visitId}
        level={profile.level}
        ingredients={ingredients.map((i) => ({
          code: i.code,
          name: i.name,
          image: i.image,
          kind: i.kind as "base" | "sauce" | "topping",
          category: i.category as IngredientCategory | null,
          have: inventory[i.code] ?? 0,
        }))}
        recipes={recipes.map((r) => ({
          code: r.code,
          name: r.name,
          image: r.image,
          cookMethod: r.cook_method as CookMethod,
          packaging: r.packaging as Packaging,
          unlockLevel: r.unlock_level,
          difficulty: recipeDifficulty(r.unlock_level),
          ingredients: r.recipe_ingredients,
        }))}
      />
    </main>
  );
}
