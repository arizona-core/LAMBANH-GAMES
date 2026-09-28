import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type Profile = Tables["profiles"]["Row"];
export type Ingredient = Tables["ingredients"]["Row"];
export type Recipe = Tables["recipes"]["Row"];
export type RecipeIngredient = Tables["recipe_ingredients"]["Row"];
export type UpgradeCatalogItem = Tables["upgrade_catalog"]["Row"];
export type InventoryRow = Tables["inventory"]["Row"];
export type MarketListing = Tables["market_listings"]["Row"];
export type MarketFeedRow = Views["market_feed"]["Row"];
export type LeaderboardRow = Views["leaderboard"]["Row"];
export type Customer = Tables["customers"]["Row"];

export type RecipeWithIngredients = Recipe & {
  recipe_ingredients: Pick<RecipeIngredient, "ingredient_code" | "qty">[];
};
