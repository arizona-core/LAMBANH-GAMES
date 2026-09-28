"use client";

import Link from "next/link";
import { useState } from "react";
import { CoinIcon, IconClock, IconLock } from "@/components/icons";
import { ItemImage } from "@/components/ItemImage";
import { useAction } from "@/components/useAction";
import { formatNumber } from "@/lib/game/format";
import type { Ingredient, RecipeWithIngredients } from "@/lib/types";

type Tab = "recipes" | "pantry";

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

  return (
    <>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === "recipes"} onClick={() => setTab("recipes")}>
          Công thức
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "pantry"} onClick={() => setTab("pantry")}>
          Kho nguyên liệu
        </button>
      </div>

      {tab === "recipes" ? (
        <div className="stack" role="tabpanel">
          {recipes.map((r) => (
            <RecipeCard key={r.code} recipe={r} level={level} inventory={inventory} names={names} />
          ))}
        </div>
      ) : (
        <div role="tabpanel" className="stack">
          <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
            Mua nguyên liệu từ nhà cung cấp. Giá rẻ hơn nữa? Ghé Chợ xem người chơi khác rao bán.
          </p>
          <div className="grid-2">
            {ingredients.map((i) => (
              <PantryCard key={i.code} ingredient={i} qty={inventory[i.code] ?? 0} coins={coins} />
            ))}
          </div>
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
  const missing = recipe.recipe_ingredients.some((ri) => (inventory[ri.ingredient_code] ?? 0) < ri.qty);

  return (
    <article className="card row" style={{ opacity: locked ? 0.7 : 1, alignItems: "flex-start" }}>
      <ItemImage code={recipe.code} image={recipe.image} name={recipe.name} size={64} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 17, fontFamily: "var(--font-body)", fontWeight: 800, color: "var(--ink)" }}>
          {recipe.name}
        </h2>
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
            <p className="row small muted" style={{ margin: 0, gap: 4, fontWeight: 700 }}>
              <IconClock size={14} /> {recipe.min_play_seconds} giây · <CoinIcon /> ~{recipe.base_price}
            </p>
          </>
        )}
      </div>
      {!locked &&
        (missing ? (
          <Link href="/kitchen?tab=pantry" className="btn btn--soft btn--sm" aria-label={`Mua nguyên liệu cho ${recipe.name}`}>
            Thiếu đồ
          </Link>
        ) : (
          <Link href={`/bake/${recipe.code}`} className="btn btn--primary btn--sm">
            Làm
          </Link>
        ))}
    </article>
  );
}

function PantryCard({ ingredient, qty, coins }: { ingredient: Ingredient; qty: number; coins: number }) {
  const { run, busy } = useAction("buy-ingredient");
  const buy = (n: number) =>
    run({ code: ingredient.code, qty: n }, { success: (d) => `Đã mua ${n} ${ingredient.name} (−${d.spent} ₵)` });

  return (
    <div className="card stack" style={{ alignItems: "center", textAlign: "center", gap: 6 }}>
      <ItemImage code={ingredient.code} image={ingredient.image} name={ingredient.name} size={64} />
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
