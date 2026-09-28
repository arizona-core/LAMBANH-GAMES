// Bố cục tiệm isometric (toạ độ ô lưới tx, ty) + bảng màu theme. Không import Phaser.

export const GRID_W = 8; // số ô theo trục x (dọc tường trái)
export const GRID_H = 7; // số ô theo trục y (dọc tường phải)

export type Theme = {
  wall: number;
  wallStripe: number;
  wallSide: number;
  floorA: number;
  floorB: number;
  counter: number;
  counterTop: number;
  accent: number;
};

export const THEMES: Record<string, Theme> = {
  default: { wall: 0xf6e7cc, wallStripe: 0xf0dcbb, wallSide: 0xe9d3ad, floorA: 0xecd6ae, floorB: 0xe3c799, counter: 0xc9722e, counterTop: 0xe8a15d, accent: 0xe28b9b },
  theme_pastel: { wall: 0xfce4ec, wallStripe: 0xf8d3df, wallSide: 0xf3c4d3, floorA: 0xe3f2fd, floorB: 0xd6e4f5, counter: 0xf48fb1, counterTop: 0xf8bbd0, accent: 0x9b7bd6 },
  theme_wood: { wall: 0xd7b48a, wallStripe: 0xcca77b, wallSide: 0xc49c6e, floorA: 0xa1775a, floorB: 0x8d6448, counter: 0x6d4c41, counterTop: 0x8d6e63, accent: 0x6fa678 },
  theme_midautumn: { wall: 0xffe0b2, wallStripe: 0xffd59a, wallSide: 0xffcc80, floorA: 0xffcc80, floorB: 0xffb74d, counter: 0xd84315, counterTop: 0xff7043, accent: 0xc62828 },
  theme_xmas: { wall: 0xe8f5e9, wallStripe: 0xd7eed9, wallSide: 0xc8e6c9, floorA: 0xffffff, floorB: 0xe0e0e0, counter: 0xc62828, counterTop: 0xef5350, accent: 0x2e7d32 },
};

/** Quầy dọc tường trái (ty ≈ 0.6), chủ tiệm đứng sau quầy. */
export const COUNTER = { tx: 4.2, ty: 0.55, len: 3.2 };
export const CHEF = { tx: 5.8, ty: 0.1 };
/** Cửa ra vào ở tường phải. */
export const DOOR = { tx: 0, ty: 5.2 };
export const DOOR_INSIDE = { tx: 0.8, ty: 5.2 };
/** Chỗ xếp hàng trước quầy (khách đầu hàng đứng sát quầy). */
export const QUEUE = [
  { tx: 5.8, ty: 1.6 },
  { tx: 4.9, ty: 2.3 },
  { tx: 4.0, ty: 3.0 },
  { tx: 3.1, ty: 3.7 },
];
export const COOKING_SPOT = { tx: 6.6, ty: 1.5 };

/** Vị trí bàn: bàn cơ bản luôn có; bàn mua thêm lần lượt vào các vị trí sau. */
export const TABLE_SPOTS = [
  { tx: 2.3, ty: 2.6 },
  { tx: 5.3, ty: 5.0 },
  { tx: 2.6, ty: 5.4 },
  { tx: 6.9, ty: 3.6 },
  { tx: 4.2, ty: 6.3 },
];

export type SeatingKind = "basic" | "decor_table" | "seat_wood" | "seat_iron" | "seat_sofa" | "seat_bar";

/** Vị trí ghế quanh 1 bàn (lệch so với tâm bàn). */
export function seatOffsets(seats: number) {
  const all = [
    { dx: -0.75, dy: 0 },
    { dx: 0.75, dy: 0 },
    { dx: 0, dy: -0.75 },
    { dx: 0, dy: 0.75 },
  ];
  return all.slice(0, seats);
}

/** Đồ treo tường trái: vị trí theo tx (0..GRID_W), độ cao trên tường (px). */
export const WALL_SPOTS: Record<string, { tx: number; h: number }> = {
  decor_neon: { tx: 1.4, h: 52 },
  wall_painting: { tx: 3.0, h: 50 },
  wall_clock: { tx: 7.4, h: 58 },
  wall_shelf: { tx: 5.6, h: 58 },
};
/** Đồ đặt sàn. */
export const FLOOR_SPOTS: Record<string, { tx: number; ty: number }> = {
  decor_plant: { tx: 7.5, ty: 6.4 },
  floor_bigplant: { tx: 0.6, ty: 0.6 },
  floor_cakecase: { tx: 2.0, ty: 0.55 },
  floor_rug: { tx: 2.3, ty: 2.6 },
};
