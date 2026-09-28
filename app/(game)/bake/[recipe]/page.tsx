import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getIngredients, getInventoryMap, getRecipes, requirePlayer } from "@/lib/game/queries";
import { BakeGame } from "./BakeGame";

export const metadata: Metadata = { title: "Làm bánh" };

export default async function BakePage({ params }: PageProps<"/bake/[recipe]">) {
  const { recipe: code } = await params;
  const { supabase, profile } = await requirePlayer();
  const [recipes, ingredients, inventory] = await Promise.all([
    getRecipes(supabase),
    getIngredients(supabase),
    getInventoryMap(supabase),
  ]);

  const index = recipes.findIndex((r) => r.code === code);
  if (index < 0) notFound();
  const recipe = recipes[index];
  if (profile.level < recipe.unlock_level) redirect("/kitchen");

  const names = Object.fromEntries(ingredients.map((i) => [i.code, i.name]));
  const needs = recipe.recipe_ingredients.map((ri) => ({
    name: names[ri.ingredient_code] ?? ri.ingredient_code,
    need: ri.qty,
    have: inventory[ri.ingredient_code] ?? 0,
  }));

  return (
    <main className="app app--oven">
      <BakeGame
        recipe={{ code: recipe.code, name: recipe.name, image: recipe.image, minPlaySeconds: recipe.min_play_seconds }}
        difficulty={index + 1}
        needs={needs}
      />
    </main>
  );
}
