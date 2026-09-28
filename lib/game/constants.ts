// a1..a4: avatar vẽ SVG; p_*: ảnh chân dung (public/images/customers). Trùng check ở DB (migration 0007).
export const AVATARS = ["a1", "a2", "a3", "a4", "p_glasses", "p_olddad", "p_curly", "p_girl", "p_cap", "p_alien"] as const;
/** Avatar có thể là 1 trong AVATARS hoặc "custom" (ảnh tự tải lên). */
export type AvatarKind = Avatar | "custom";
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

export const AVATAR_PHOTOS: Partial<Record<Avatar, string>> = {
  p_glasses: "/images/customers/glasses-man.webp",
  p_olddad: "/images/customers/old-dad.webp",
  p_curly: "/images/customers/curly-man.webp",
  p_girl: "/images/customers/asian-girl.webp",
  p_cap: "/images/customers/cap-man.webp",
  p_alien: "/images/customers/alien.webp",
};

export const AVATAR_BG: Record<AvatarKind, string> = {
  a1: "#FFE0C4",
  a2: "#F6D2DA",
  a3: "#D9EAD3",
  a4: "#D6E4F5",
  p_glasses: "#FFF6E9",
  p_olddad: "#FFF6E9",
  p_curly: "#FFF6E9",
  p_girl: "#FFF6E9",
  p_cap: "#FFF6E9",
  p_alien: "#FFF6E9",
  custom: "#FFF6E9",
};

export const RENAME_COST_GEMS = 20;
export const MARKET_UNLOCK_LEVEL = 3;
/** Tiệm phải mở ít nhất chừng này giờ mới dùng chợ (chống acc phụ). */
export const MARKET_MIN_ACCOUNT_HOURS = 24;
/** Giá mỗi lô: 50%..200% giá tham chiếu — trùng public.create_listing. */
export const MARKET_PRICE_MIN_PCT = 50;
export const MARKET_PRICE_MAX_PCT = 200;
export const MARKET_FEE_PERCENT = 5;
