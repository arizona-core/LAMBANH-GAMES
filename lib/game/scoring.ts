// Chấm điểm 1 lần "CHẠM" trong mini-game (chạy ở client để phản hồi tức thì).
// Server chỉ nhận điểm 0..100 của 3 bước rồi TỰ quyết số sao và kiểm tra thời gian chơi tối thiểu.
// Các hàm "preview"/"npc"/"fee" dưới đây trùng công thức server, CHỈ để hiển thị trước.

export type Zone = { start: number; width: number }; // vị trí trên thanh, 0..1

/** Điểm theo khoảng cách kim tới tâm vùng vàng: trong vùng 70..100, ngoài vùng giảm dần về 0. */
export function scoreTap(needle: number, zone: Zone): number {
  const center = zone.start + zone.width / 2;
  const half = zone.width / 2;
  const dist = Math.abs(needle - center);
  if (dist <= half) return Math.round(100 - (dist / half) * 30);
  const outside = dist - half;
  return Math.max(0, Math.round(70 - (outside / 0.35) * 70));
}

/** Ngưỡng sao — trùng với public.finish_bake. */
export function starsForScore(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 55) return 3;
  if (score >= 35) return 2;
  return 1;
}

export function previewStars(scores: number[], ovenBonus = 0): number {
  if (scores.length === 0) return 0;
  const avg = Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length);
  return starsForScore(Math.min(100, avg + ovenBonus));
}

/** Hệ số giá theo sao — trùng public._quality_pct. */
export const QUALITY_PCT = [60, 80, 100, 125, 150] as const;

/** Giá bán NPC / chiếc — trùng public.sell_to_npc. */
export function npcUnitPrice(basePrice: number, quality: number, displayBonus: number): number {
  const q = Math.floor((basePrice * QUALITY_PCT[quality - 1]) / 100);
  return Math.floor((q * (100 + displayBonus)) / 100);
}

/** Phí chợ 5% làm tròn lên — trùng public.market_fee. */
export function marketFee(price: number): number {
  return Math.floor((price * 5 + 99) / 100);
}

/** Tổng quan từ profiles.review_counts (số đánh giá 1★..5★ trọn đời) — trùng view public_profiles. */
export function reviewSummary(counts: readonly number[]): { total: number; avg: number } {
  const total = counts.reduce((a, b) => a + b, 0);
  const avg = total ? counts.reduce((s, n, i) => s + n * (i + 1), 0) / total : 0;
  return { total, avg };
}
