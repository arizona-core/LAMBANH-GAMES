import type { Metadata } from "next";
import { getIngredients, getInventoryMap, getRecipes, requirePlayer } from "@/lib/game/queries";
import { OrderFlow } from "./OrderFlow";

export const metadata: Metadata = { title: "Làm đơn" };

export default async function OrderPage({ params }: PageProps<"/order/[visitId]">) {
  const { visitId } = await params;
  const { supabase } = await requirePlayer();
  const [ingredients, inventory, recipes] = await Promise.all([
    getIngredients(supabase),
    getInventoryMap(supabase),
    getRecipes(supabase),
  ]);

  return (
    <main className="app app--oven">
      <OrderFlow
        visitId={visitId}
        ingredients={ingredients.map((i) => ({
          code: i.code,
          name: i.name,
          image: i.image,
          kind: i.kind as "base" | "sauce" | "topping",
          have: inventory[i.code] ?? 0,
        }))}
        recipes={recipes.map((r, index) => ({
          code: r.code,
          name: r.name,
          image: r.image,
          cookMethod: r.cook_method as "bake" | "fry" | "steam",
          packaging: r.packaging as "box" | "bag",
          difficulty: index + 1,
          ingredients: r.recipe_ingredients,
        }))}
      />
    </main>
  );
}
