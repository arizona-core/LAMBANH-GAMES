export const AVATARS = ["a1", "a2", "a3", "a4"] as const;
export type Avatar = (typeof AVATARS)[number];

export const SHOP_COLORS = {
  caramel: { label: "Caramel", hex: "#D98A3D" },
  strawberry: { label: "Hồng dâu", hex: "#E28B9B" },
  mint: { label: "Xanh bạc hà", hex: "#6FA678" },
  ocean: { label: "Xanh biển", hex: "#5B8DBE" },
  lavender: { label: "Tím", hex: "#9B7BD6" },
  honey: { label: "Vàng", hex: "#E7B23C" },
} as const;
export type ShopColor = keyof typeof SHOP_COLORS;

export const AVATAR_BG: Record<Avatar, string> = {
  a1: "#FFE0C4",
  a2: "#F6D2DA",
  a3: "#D9EAD3",
  a4: "#D6E4F5",
};

export const RENAME_COST_GEMS = 20;
export const MARKET_UNLOCK_LEVEL = 3;
/** Tiệm phải mở ít nhất chừng này giờ mới dùng chợ (chống acc phụ). */
export const MARKET_MIN_ACCOUNT_HOURS = 24;
/** Giá mỗi lô: 50%..200% giá tham chiếu — trùng public.create_listing. */
export const MARKET_PRICE_MIN_PCT = 50;
export const MARKET_PRICE_MAX_PCT = 200;
export const MARKET_FEE_PERCENT = 5;
