// Kiểu dữ liệu đơn khách (khớp public._visit_json) + nhãn hiển thị.
import type { OpsTick } from "./operations";

export type CookMethod = "bake" | "fry" | "steam" | "chill";
export type Packaging = "box" | "bag";

export const COOK_METHODS: Record<CookMethod, string> = { bake: "Nướng", fry: "Chiên", steam: "Hấp", chill: "Làm lạnh" };
export const PACKAGING: Record<Packaging, string> = { box: "Hộp giấy", bag: "Túi giấy" };

/** Nhóm nguyên liệu gốc (khớp cột ingredients.category) — thứ tự hiển thị trong kho/tô trộn. */
export type IngredientCategory = "flour" | "dairy" | "sweet" | "fruit" | "nut";
export const INGREDIENT_CATEGORIES: Record<IngredientCategory, string> = {
  flour: "Bột & men",
  dairy: "Sữa, trứng & bơ",
  sweet: "Đường, hương liệu & dầu",
  fruit: "Trái cây & lá thơm",
  nut: "Hạt & đồ khô",
};

/** Độ khó mini-game 1..9 theo cấp mở khoá món (cấp 1 → 1, cấp 25 → 9). */
export function recipeDifficulty(unlockLevel: number): number {
  return Math.min(9, Math.max(1, 1 + Math.floor((unlockLevel - 1) / 3)));
}

export type VisitCustomer = {
  id: number;
  name: string;
  gender: "m" | "f";
  personality: string;
  bio: string;
  impatient: boolean;
  dine_and_dash: boolean;
  picky: boolean;
  min_quality: number;
  /** Bụng yếu: dễ bị ngộ độc gấp đôi. */
  sensitive: boolean;
  look: number;
  /** Ảnh chân dung (người dùng gửi sau); null → dùng avatar vẽ bằng SVG. */
  image: string | null;
};

export type Visit = {
  id: string;
  status: "waiting" | "cooking" | "served";
  arrive_at: string;
  leave_at: string;
  recipe: string;
  recipe_name: string;
  recipe_image: string | null;
  sauce: string | null;
  sauce_name: string | null;
  topping: string | null;
  topping_name: string | null;
  customer: VisitCustomer;
};

export type TickResult = {
  server_now: string;
  clock: { minute_of_day: number; hour: number; minute: number; open: boolean };
  traffic: "rush" | "normal" | "quiet";
  /** Chủ tiệm đang mở cửa (false = tự đóng, không sinh khách). */
  shop_open: boolean;
  left: number;
  /** Khách hết hạn chờ lúc chủ tiệm offline → ra về, không phạt. */
  closed_offline: number;
  reputation_lost: number;
  generated: number;
  visits: Visit[];
  seats: number;
  /** Khách vừa ăn xong đang ngồi ghế (served trong ~40 giây). */
  seated: (Visit & { served_at: string })[];
  /** Vận hành: vệ sinh, hóa đơn, thanh tra, lì xì. */
  ops: OpsTick;
};

export type AcceptResult = Visit & { session_id: string; min_play_seconds: number; oven_bonus: number };

export type OrderResult = {
  dashed: boolean;
  /** Khách bị ngộ độc thực phẩm: không trả tiền, tiệm bồi thường `compensation`. */
  poisoned: boolean;
  compensation?: number;
  paid?: number;
  lost?: number;
  tip?: number;
  /** Mức vệ sinh sau đơn này. */
  hygiene: number;
  quality: number;
  score: number;
  reputation_delta?: number;
  notes: string[];
  tired?: boolean;
  xp_gained: number;
  level: number;
  leveled_up: boolean;
  customer: string;
};

/** Mô tả món khách gọi: "Bánh mì · sốt bơ tỏi · phô mai" */
export function orderText(v: Pick<Visit, "recipe_name" | "sauce_name" | "topping_name">): string {
  return [
    v.recipe_name,
    v.sauce_name ? v.sauce_name.toLowerCase() : "không sốt",
    v.topping_name ? v.topping_name.toLowerCase() : "không topping",
  ].join(" · ");
}
