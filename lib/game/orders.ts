// Kiểu dữ liệu đơn khách (khớp public._visit_json) + nhãn hiển thị.

export type CookMethod = "bake" | "fry" | "steam";
export type Packaging = "box" | "bag";

export const COOK_METHODS: Record<CookMethod, string> = { bake: "Nướng", fry: "Chiên", steam: "Hấp" };
export const PACKAGING: Record<Packaging, string> = { box: "Hộp giấy", bag: "Túi giấy" };

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
  traffic: "closed" | "rush" | "normal" | "quiet";
  left: number;
  reputation_lost: number;
  generated: number;
  visits: Visit[];
  seats: number;
  /** Khách vừa ăn xong đang ngồi ghế (served trong ~40 giây). */
  seated: (Visit & { served_at: string })[];
};

export type AcceptResult = Visit & { session_id: string; min_play_seconds: number; oven_bonus: number };

export type OrderResult = {
  dashed: boolean;
  paid?: number;
  lost?: number;
  tip?: number;
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
