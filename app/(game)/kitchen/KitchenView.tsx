"use client";

import { useState } from "react";
import { CoinIcon, IconLock } from "@/components/icons";
import { ItemImage } from "@/components/ItemImage";
import { useAction } from "@/components/useAction";
import { formatNumber } from "@/lib/game/format";
import {
  COOK_METHODS,
  INGREDIENT_CATEGORIES,
  PACKAGING,
  type CookMethod,
  type IngredientCategory,
  type Packaging,
} from "@/lib/game/orders";
import type { Ingredient, RecipeWithIngredients } from "@/lib/types";

type Tab = "recipes" | "pantry";

// Nguyên liệu gốc chia theo nhóm (ingredients.category), rồi tới sốt và topping.
const PANTRY_GROUPS: { key: string; title: string; match: (i: Ingredient) => boolean }[] = [
  ...(Object.keys(INGREDIENT_CATEGORIES) as IngredientCategory[]).map((cat) => ({
    key: cat,
    title: INGREDIENT_CATEGORIES[cat],
    match: (i: Ingredient) => i.kind === "base" && i.category === cat,
  })),
  { key: "sauce", title: "Nước chấm & sốt", match: (i) => i.kind === "sauce" },
  { key: "topping", title: "Topping", match: (i) => i.kind === "topping" },
];

export function KitchenView({
  level,
  coins,
  recipes,
  ingredients,
  inventory,
  initialTab,
}: {
  level: number;
  coins: number;
  recipes: RecipeWithIngredients[];
  ingredients: Ingredient[];
  inventory: Record<string, number>;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const names = Object.fromEntries(ingredients.map((i) => [i.code, i.name]));
  // Chỉ hé lộ các món sắp mở (tới 2 cấp sau), còn lại gộp thành 1 dòng cho gọn.
  const visibleRecipes = recipes.filter((r) => r.unlock_level <= level + 2);
  const hiddenCount = recipes.length - visibleRecipes.length;

  return (
    <>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === "recipes"} onClick={() => setTab("recipes")}>
          Sổ công thức
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "pantry"} onClick={() => setTab("pantry")}>
          Kho nguyên liệu
        </button>
      </div>

      {tab === "recipes" ? (
        <div className="stack" role="tabpanel">
          <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
            Bánh được làm theo đơn khi khách tới quầy. Nhớ công thức để làm nhanh và đúng!
          </p>
          {visibleRecipes.map((r) => (
            <RecipeCard key={r.code} recipe={r} level={level} inventory={inventory} names={names} />
          ))}
          {hiddenCount > 0 && (
            <p className="small muted" style={{ margin: 0, fontWeight: 700, textAlign: "center" }}>
              Còn {hiddenCount} món nữa mở khoá ở cấp cao hơn.
            </p>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="stack">
          <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
            Mua từ nhà cung cấp. Giá rẻ hơn? Ghé Chợ xem người chơi khác rao bán.
          </p>
          {PANTRY_GROUPS.map((g) => (
            <section key={g.key} className="stack">
              <h2 style={{ fontSize: 17 }}>{g.title}</h2>
              <div className="grid-2">
                {ingredients.filter(g.match).map((i) => (
                  <PantryCard key={i.code} ingredient={i} qty={inventory[i.code] ?? 0} coins={coins} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function RecipeCard({
  recipe,
  level,
  inventory,
  names,
}: {
  recipe: RecipeWithIngredients;
  level: number;
  inventory: Record<string, number>;
  names: Record<string, string>;
}) {
  const locked = level < recipe.unlock_level;

  return (
    <article className="card row" style={{ opacity: locked ? 0.7 : 1, alignItems: "flex-start" }}>
      <ItemImage code={recipe.code} image={recipe.image} name={recipe.name} size={64} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 17, fontFamily: "var(--font-body)", fontWeight: 800, color: "var(--ink)" }}>{recipe.name}</h2>
        {locked ? (
          <p className="row small muted" style={{ margin: "6px 0 0", gap: 6, fontWeight: 700 }}>
            <IconLock size={16} /> Mở khoá ở Cấp {recipe.unlock_level}
          </p>
        ) : (
          <>
            <p className="small" style={{ margin: "4px 0", fontWeight: 700, lineHeight: 1.5 }}>
              {recipe.recipe_ingredients.map((ri, i) => {
                const enough = (inventory[ri.ingredient_code] ?? 0) >= ri.qty;
                return (
                  <span key={ri.ingredient_code} style={{ color: enough ? "var(--ink-muted)" : "var(--danger)" }}>
                    {i > 0 && " · "}
                    {names[ri.ingredient_code]} ×{ri.qty}
                  </span>
                );
              })}
            </p>
            <p className="row small muted" style={{ margin: 0, gap: 6, fontWeight: 700, flexWrap: "wrap" }}>
              <span className="badge">{COOK_METHODS[recipe.cook_method as CookMethod]}</span>
              <span className="badge">{PACKAGING[recipe.packaging as Packaging]}</span>
              <span className="row" style={{ gap: 4 }}>
                <CoinIcon /> ~{recipe.base_price}
              </span>
            </p>
          </>
        )}
      </div>
    </article>
  );
}

function PantryCard({ ingredient, qty, coins }: { ingredient: Ingredient; qty: number; coins: number }) {
  const { run, busy } = useAction("buy-ingredient");
  const buy = (n: number) =>
    run({ code: ingredient.code, qty: n }, { success: (d) => `Đã mua ${n} ${ingredient.name} (−${d.spent} ₵)` });

  return (
    <div className="card stack" style={{ alignItems: "center", textAlign: "center", gap: 6 }}>
      <ItemImage code={ingredient.code} image={ingredient.image} name={ingredient.name} size={56} />
      <div style={{ fontWeight: 800 }}>{ingredient.name}</div>
      <div className="small muted" style={{ fontWeight: 700 }}>
        Trong kho: <strong style={{ color: "var(--ink)" }}>{qty}</strong>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {[1, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="btn btn--soft btn--sm"
            disabled={busy || coins < ingredient.price * n}
            onClick={() => buy(n)}
            aria-label={`Mua ${n} ${ingredient.name} giá ${ingredient.price * n} xu`}
          >
            +{n} · {formatNumber(ingredient.price * n)}₵
          </button>
        ))}
      </div>
    </div>
  );
}
