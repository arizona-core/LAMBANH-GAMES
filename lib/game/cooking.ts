// Hiển thị mini-game nấu bánh: màu bột trong tô, thước độ sệt / độ chín, hình bánh ở màn kết quả.
// CHỈ để hiển thị — điểm vẫn tính bằng scoreTap (0..100) rồi server tự quyết số sao.
import type { CookMethod } from "@/lib/game/orders";
import type { Zone } from "@/lib/game/scoring";

const BATTER_BASE = { color: 0xf6e7c1, weight: 1 };

/** Nguyên liệu làm đổi màu bột (mã → màu + độ "át" màu). Nguyên liệu khác giữ màu bột kem. */
const BATTER_TINT: Record<string, { color: number; weight: number }> = {
  cocoa: { color: 0x6b3a1e, weight: 2.5 },
  chocolate: { color: 0x5a2e14, weight: 2.5 },
  coffee: { color: 0x7a4a2a, weight: 2 },
  brown_sugar: { color: 0xb9793d, weight: 0.8 },
  cinnamon: { color: 0xa0592a, weight: 0.8 },
  matcha: { color: 0x8db356, weight: 2 },
  pandan: { color: 0x5fa35a, weight: 1.8 },
  egg: { color: 0xf7d45c, weight: 0.8 },
  salted_egg: { color: 0xf29a38, weight: 1 },
  butter: { color: 0xf7e08a, weight: 0.5 },
  cheese: { color: 0xf4c542, weight: 0.6 },
  strawberry: { color: 0xe8798a, weight: 0.8 },
  cherry: { color: 0xb8364f, weight: 0.8 },
  blueberry: { color: 0x6c6fb8, weight: 0.8 },
  banana: { color: 0xf2dc7a, weight: 0.5 },
  carrot: { color: 0xee8434, weight: 0.8 },
  mung_bean: { color: 0xe6c74c, weight: 0.8 },
  white_chocolate: { color: 0xfaf3e3, weight: 0.6 },
};

/** Màu bột trong tô = trung bình có trọng số của màu nền kem và các nguyên liệu có màu. */
export function batterColor(codes: readonly string[]): number {
  const parts = [BATTER_BASE, ...codes.flatMap((c) => (BATTER_TINT[c] ? [BATTER_TINT[c]] : []))];
  const total = parts.reduce((s, p) => s + p.weight, 0);
  const channel = (shift: number) =>
    Math.round(parts.reduce((s, p) => s + ((p.color >> shift) & 0xff) * p.weight, 0) / total);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Trộn 2 màu: t = 0 → a, t = 1 → b. */
export function mixColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - k) + ((b >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Màu ruột bánh chín (món chưa có ảnh vẽ bánh chung theo màu này): bột ngả vàng nâu khi nướng. */
export function bakedColor(batter: number): number {
  return mixColor(batter, 0xd9964a, 0.55);
}

/** Bánh lấy ra lúc nào: chưa tới vùng vàng / trong vùng / quá vùng. */
export type CookStage = "raw" | "good" | "over";

export function cookStage(progress: number, zone: Zone): CookStage {
  if (progress < zone.start) return "raw";
  if (progress > zone.start + zone.width) return "over";
  return "good";
}

/** Nhãn 3 đoạn của thước: [chưa tới, vừa đẹp, quá tay]. */
export const MIX_GAUGE = ["Lợn cợn", "Mịn", "Quá loãng"] as const;
export const COOK_GAUGE: Record<CookMethod, readonly [string, string, string]> = {
  bake: ["Sống", "Vàng ruộm", "Cháy"],
  fry: ["Sống", "Vàng giòn", "Cháy"],
  steam: ["Sống", "Chín mềm", "Nhão"],
  chill: ["Lỏng", "Đông vừa", "Đông đá"],
};

/** Nơi nấu theo cách nấu (dùng trong câu hướng dẫn "Kéo khay vào …"). */
export const COOK_PLACE: Record<CookMethod, string> = { bake: "lò", fry: "chảo", steam: "xửng hấp", chill: "tủ lạnh" };

/** Câu báo khi đã lấy bánh ra. */
export const DONE_TEXT: Record<CookMethod, string> = {
  bake: "Bánh ra lò!",
  fry: "Vớt bánh ra!",
  steam: "Bánh chín rồi!",
  chill: "Lấy bánh ra!",
};

/** CSS filter cho ảnh bánh ở màn kết quả, theo lúc lấy bánh ra. */
export function dishFilter(method: CookMethod, stage: CookStage): string {
  if (stage === "good") return "none";
  if (stage === "raw") {
    return method === "chill" ? "saturate(0.75) brightness(1.06)" : "brightness(1.12) saturate(0.55) sepia(0.15)";
  }
  if (method === "chill") return "hue-rotate(-12deg) saturate(0.55) brightness(1.1)";
  if (method === "steam") return "saturate(0.6) brightness(0.95)";
  return "brightness(0.62) sepia(0.45) saturate(1.2)";
}
