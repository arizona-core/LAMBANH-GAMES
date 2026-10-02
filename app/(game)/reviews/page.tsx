import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getIngredients, getRecipes, requirePlayer } from "@/lib/game/queries";
import { reviewSummary } from "@/lib/game/scoring";
import { ReviewsView, type ReviewItem } from "./ReviewsView";

export const metadata: Metadata = { title: "Đánh giá" };

export default async function ReviewsPage() {
  const { supabase, profile } = await requirePlayer();
  const [{ data: latest }, recipes, ingredients] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "id, stars, comment, reply, replied_at, created_at, customers(name, image, look, personality), customer_visits(recipe_code, sauce_code, topping_code)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    getRecipes(supabase),
    getIngredients(supabase),
  ]);

  const names = Object.fromEntries([...recipes, ...ingredients].map((x) => [x.code, x.name]));
  // Bộ đếm trọn đời do trigger server cập nhật; bảng reviews chỉ giữ ~200 đánh giá mới nhất.
  const counts = profile.review_counts;
  const { total, avg } = reviewSummary(counts);

  const items: ReviewItem[] = (latest ?? []).map((r) => ({
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    reply: r.reply,
    createdAt: r.created_at,
    customer: {
      name: r.customers?.name ?? "Khách",
      image: r.customers?.image ?? null,
      look: r.customers?.look ?? 0,
      personality: r.customers?.personality ?? "",
    },
    order: [
      names[r.customer_visits?.recipe_code ?? ""],
      r.customer_visits?.sauce_code ? names[r.customer_visits.sauce_code] : null,
      r.customer_visits?.topping_code ? names[r.customer_visits.topping_code] : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Đánh giá" />
        <ReviewsView avg={avg} total={total} counts={counts} items={items} reputation={profile.reputation} />
      </div>
      <BottomNav />
    </main>
  );
}
