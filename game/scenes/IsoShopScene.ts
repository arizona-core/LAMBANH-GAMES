// Cảnh tiệm 2.5D isometric: tường, sàn, quầy, bàn ghế + đồ trang trí đã mua, khách đi lại.
// React gọi sync() mỗi giây với danh sách khách (server quyết định ai tới/đi/ngồi);
// scene chỉ diễn hoạt: đi từ cửa → xếp hàng → quầy → ghế ngồi → ra về.
import * as Phaser from "phaser";
import {
  CHEF,
  COOKING_SPOT,
  COUNTER,
  DOOR,
  DOOR_INSIDE,
  FLOOR_SPOTS,
  GRID_H,
  GRID_W,
  QUEUE,
  TABLE_SPOTS,
  THEMES,
  WALL_SPOTS,
  seatOffsets,
  type Theme,
} from "@/game/shop/layout";

export type SceneCustomer = {
  id: string;
  status: "waiting" | "cooking" | "seated";
  image: string | null;
  name: string;
  look: number;
  impatient: boolean;
  /** Thứ tự sắp xếp: arrive_at (hàng chờ) hoặc served_at (ghế). */
  order: number;
};

export type IsoShopConfig = {
  theme: string;
  decor: string[]; // mã đồ trang trí đã mua
  chefImage: string | null;
  hour: number;
  /** Danh sách khách mới nhất (wrapper cập nhật), scene đọc khi vừa dựng xong. */
  feed?: { list: SceneCustomer[] };
};

type Pt = { tx: number; ty: number };
type Actor = {
  box: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  status: SceneCustomer["status"];
  target: string;
};

const AVATAR_R = 14; // bán kính avatar khách (px)
const HEAD_Y = -26; // tâm avatar so với chân
const BG = [0xffe0c4, 0xf6d2da, 0xd9ead3, 0xd6e4f5];
/** Viền avatar theo trạng thái: chờ = vàng, đang làm = cam, đang ăn = xanh. */
const RING: Record<SceneCustomer["status"], number> = { waiting: 0xe7b23c, cooking: 0xd98a3d, seated: 0x6fa678 };
const WALL_H = 78;
const SPEED = 70; // px/giây

function skyColor(hour: number): number {
  if (hour < 5) return 0x27305a;
  if (hour < 8) return 0xf7b28a;
  if (hour < 16) return 0x9ed3f3;
  if (hour < 19) return 0xf2956b;
  return 0x27305a;
}

function shade(color: number, f: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(Math.min(255, c.red * f), Math.min(255, c.green * f), Math.min(255, c.blue * f));
}

export class IsoShopScene extends Phaser.Scene {
  private cfg!: IsoShopConfig;
  private theme!: Theme;
  private tw = 40;
  private th = 20;
  private ox = 0;
  private oy = 0;
  private sky!: Phaser.GameObjects.Graphics;
  private skyPoly: Phaser.Geom.Point[] = [];
  private actors = new Map<string, Actor>();
  private seats: Pt[] = [];
  private firstSync = true;
  private pending: SceneCustomer[] | null = null;
  private loaded = new Set<string>();
  private ready = false;

  constructor() {
    super("iso-shop");
  }

  init(cfg: IsoShopConfig) {
    this.cfg = cfg;
    this.theme = THEMES[cfg.theme] ?? THEMES.default;
    this.actors.clear();
    this.firstSync = true;
    this.ready = false;
  }

  preload() {
    if (this.cfg.chefImage) this.load.image("chef", this.cfg.chefImage);
  }

  // ---------------------------------------------------------------- toạ độ
  private iso(tx: number, ty: number) {
    return { x: this.ox + ((tx - ty) * this.tw) / 2, y: this.oy + ((tx + ty) * this.th) / 2 };
  }

  create() {
    const { width } = this.scale;
    this.tw = Math.floor((width * 0.94 * 2) / (GRID_W + GRID_H));
    this.th = this.tw / 2;
    this.ox = width / 2 + ((GRID_H - GRID_W) * this.tw) / 4;
    this.oy = WALL_H + 14;

    this.drawRoom();
    this.drawCounter();
    this.drawDecor();
    this.setHour(this.cfg.hour);
    this.ready = true;
    const initial = this.pending ?? this.cfg.feed?.list ?? null;
    if (initial) {
      const list = initial;
      this.pending = null;
      this.sync(list);
    }
  }

  // ---------------------------------------------------------------- vẽ phòng
  private quad(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], color: number) {
    g.fillStyle(color, 1);
    g.fillPoints(pts.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  }

  private drawRoom() {
    const t = this.theme;
    const g = this.add.graphics().setDepth(-1000);

    // Sàn caro
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        this.quad(
          g,
          [this.iso(x, y), this.iso(x + 1, y), this.iso(x + 1, y + 1), this.iso(x, y + 1)],
          (x + y) % 2 ? t.floorA : t.floorB,
        );
      }
    }

    // Tường trái (dọc trục x, ty = 0) có sọc; tường phải (dọc trục y, tx = 0)
    for (let x = 0; x < GRID_W; x++) {
      const a = this.iso(x, 0);
      const b = this.iso(x + 1, 0);
      this.quad(g, [a, b, { x: b.x, y: b.y - WALL_H }, { x: a.x, y: a.y - WALL_H }], x % 2 ? t.wall : t.wallStripe);
    }
    for (let y = 0; y < GRID_H; y++) {
      const a = this.iso(0, y);
      const b = this.iso(0, y + 1);
      this.quad(g, [a, b, { x: b.x, y: b.y - WALL_H }, { x: a.x, y: a.y - WALL_H }], t.wallSide);
    }
    // Chân tường
    g.lineStyle(4, shade(t.wallSide, 0.8), 1);
    g.lineBetween(this.iso(0, 0).x, this.iso(0, 0).y, this.iso(GRID_W, 0).x, this.iso(GRID_W, 0).y);
    g.lineBetween(this.iso(0, 0).x, this.iso(0, 0).y, this.iso(0, GRID_H).x, this.iso(0, GRID_H).y);

    // Cửa sổ tường phải (ty 1.4 → 3.4) — màu trời đổi theo giờ game
    const w0 = this.iso(0, 1.4);
    const w1 = this.iso(0, 3.4);
    this.skyPoly = [
      new Phaser.Geom.Point(w0.x, w0.y - 62),
      new Phaser.Geom.Point(w1.x, w1.y - 62),
      new Phaser.Geom.Point(w1.x, w1.y - 22),
      new Phaser.Geom.Point(w0.x, w0.y - 22),
    ];
    this.sky = this.add.graphics().setDepth(-999);
    const frame = this.add.graphics().setDepth(-998);
    frame.lineStyle(4, 0xffffff, 1);
    frame.strokePoints(this.skyPoly, true);
    const mid = this.iso(0, 2.4);
    frame.lineBetween(mid.x, mid.y - 62, mid.x, mid.y - 22);

    // Cửa ra vào tường phải (ty 4.7 → 5.7)
    const d0 = this.iso(0, 4.7);
    const d1 = this.iso(0, 5.7);
    this.quad(g, [d0, d1, { x: d1.x, y: d1.y - 58 }, { x: d0.x, y: d0.y - 58 }], 0x8a5a2b);
    g.fillStyle(0xe7b23c, 1).fillCircle(d1.x + 4, d1.y - 28, 2.5);
  }

  setHour(hour: number) {
    if (!this.sky) return;
    this.sky.clear();
    this.sky.fillStyle(skyColor(hour), 1).fillPoints(this.skyPoly, true);
    const c = this.skyPoly[0];
    const night = hour < 5 || hour >= 19;
    this.sky.fillStyle(night ? 0xf4f1de : 0xffd76a, 1).fillCircle(c.x - 10, c.y + 14, 5);
  }

  /** Hộp isometric có đáy w×d ô, tâm tại (tx, ty), cao h px. */
  private box(tx: number, ty: number, w: number, d: number, h: number, color: number, depthBias = 0) {
    const g = this.add.graphics();
    const x0 = tx - w / 2;
    const y0 = ty - d / 2;
    const p = (x: number, y: number, z: number) => {
      const q = this.iso(x, y);
      return { x: q.x, y: q.y - z };
    };
    // mặt trái (hướng về trục y+), mặt phải (trục x+), mặt trên
    this.quad(g, [p(x0, y0 + d, 0), p(x0 + w, y0 + d, 0), p(x0 + w, y0 + d, h), p(x0, y0 + d, h)], shade(color, 0.78));
    this.quad(g, [p(x0 + w, y0, 0), p(x0 + w, y0 + d, 0), p(x0 + w, y0 + d, h), p(x0 + w, y0, h)], shade(color, 0.9));
    this.quad(g, [p(x0, y0, h), p(x0 + w, y0, h), p(x0 + w, y0 + d, h), p(x0, y0 + d, h)], color);
    g.setDepth(this.iso(tx + w / 2, ty + d / 2).y + depthBias);
    return g;
  }

  private drawCounter() {
    const t = this.theme;
    // Quầy dài dọc trục x: xếp lớp theo góc trước-trái (gần tường) để khách đứng trước quầy
    // luôn được vẽ đè lên quầy, còn chủ tiệm đứng sau quầy bị quầy che phần thân.
    const depth = this.iso(COUNTER.tx - COUNTER.len / 2, COUNTER.ty + 0.4).y;
    this.box(COUNTER.tx, COUNTER.ty, COUNTER.len, 0.8, 26, t.counter).setDepth(depth);
    this.box(COUNTER.tx, COUNTER.ty, COUNTER.len, 0.8, 27, t.counterTop).setAlpha(0.35).setDepth(depth + 0.1);
    // Máy tính tiền + khay bánh trên quầy
    this.box(COUNTER.tx + 1.1, COUNTER.ty, 0.35, 0.35, 40, 0x4a4a4a).setDepth(depth + 0.2);
    this.box(COUNTER.tx - 0.8, COUNTER.ty, 0.6, 0.45, 32, 0xfff6e9).setDepth(depth + 0.2);

    // Chủ tiệm sau quầy
    const c = this.iso(CHEF.tx, CHEF.ty);
    const chef = this.add.container(c.x, c.y).setDepth(depth - 1);
    chef.add(this.add.ellipse(0, 0, 18, 7, 0x000000, 0.15));
    chef.add(this.add.rectangle(0, -14, 16, 22, 0xffffff).setStrokeStyle(1, 0xe4cfa8));
    if (this.textures.exists("chef")) {
      chef.add(this.add.circle(0, -38, AVATAR_R + 3, 0xffffff));
      chef.add(this.add.image(0, -38, "chef").setDisplaySize(AVATAR_R * 2, AVATAR_R * 2));
    } else {
      chef.add(this.add.circle(0, -32, 9, 0xf6c99b));
      chef.add(this.add.rectangle(0, -44, 16, 8, 0xffffff).setStrokeStyle(1, 0xe4cfa8));
    }
  }

  // ---------------------------------------------------------------- đồ trang trí
  private wallItem(tx: number, h: number, wTiles: number, hPx: number, color: number, stroke = 0xffffff) {
    const g = this.add.graphics().setDepth(-900);
    const a = this.iso(tx - wTiles / 2, 0);
    const b = this.iso(tx + wTiles / 2, 0);
    const pts = [
      { x: a.x, y: a.y - h - hPx },
      { x: b.x, y: b.y - h - hPx },
      { x: b.x, y: b.y - h },
      { x: a.x, y: a.y - h },
    ];
    this.quad(g, pts, color);
    g.lineStyle(2, stroke, 1).strokePoints(pts.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    return { g, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - h - hPx / 2 } };
  }

  private drawTable(spot: Pt, kind: string) {
    const t = this.theme;
    const wood = kind === "seat_iron" ? 0x5b5f66 : kind === "seat_sofa" ? 0xe28b9b : shade(t.counter, 1.05);
    const seatCount = kind === "seat_bar" ? 4 : kind === "seat_sofa" ? 3 : 2;

    if (kind === "seat_sofa") {
      this.box(spot.tx - 0.6, spot.ty, 0.5, 1.8, 14, wood);
      this.box(spot.tx - 0.85, spot.ty, 0.2, 1.8, 26, shade(wood, 0.9), -2);
      this.box(spot.tx + 0.35, spot.ty, 0.6, 0.6, 12, 0xa0561a);
    } else if (kind === "seat_bar") {
      this.box(spot.tx, spot.ty, 2.2, 0.5, 24, 0x6d4c41);
    } else {
      this.box(spot.tx, spot.ty, 0.8, 0.8, 16, wood);
      this.box(spot.tx, spot.ty, 0.18, 0.18, 24, 0xfff6e9, 3); // bình hoa nhỏ
    }

    const offsets =
      kind === "seat_sofa"
        ? [{ dx: -0.6, dy: -0.55 }, { dx: -0.6, dy: 0 }, { dx: -0.6, dy: 0.55 }]
        : kind === "seat_bar"
          ? [{ dx: -0.8, dy: 0.6 }, { dx: -0.27, dy: 0.6 }, { dx: 0.27, dy: 0.6 }, { dx: 0.8, dy: 0.6 }]
          : seatOffsets(seatCount);
    for (const o of offsets) {
      const s = { tx: spot.tx + o.dx, ty: spot.ty + o.dy };
      if (kind !== "seat_sofa") this.box(s.tx, s.ty, 0.36, 0.36, kind === "seat_bar" ? 14 : 9, shade(wood, 0.85), -3);
      this.seats.push(s);
    }
  }

  private drawDecor() {
    const owned = new Set(this.cfg.decor);
    const t = this.theme;

    // Bàn ghế: bàn cơ bản + các bộ đã mua theo thứ tự
    const seating = ["decor_table", "seat_wood", "seat_iron", "seat_sofa", "seat_bar"].filter((c) => owned.has(c));
    if (owned.has("floor_rug")) {
      const r = FLOOR_SPOTS.floor_rug;
      const g = this.add.graphics().setDepth(-950);
      const c = this.iso(r.tx, r.ty);
      g.fillStyle(t.accent, 0.85).fillEllipse(c.x, c.y, this.tw * 2.2, this.th * 2.2);
      g.lineStyle(3, 0xffffff, 0.8).strokeEllipse(c.x, c.y, this.tw * 1.8, this.th * 1.8);
    }
    this.drawTable(TABLE_SPOTS[0], "basic");
    seating.forEach((code, i) => this.drawTable(TABLE_SPOTS[i + 1] ?? TABLE_SPOTS[TABLE_SPOTS.length - 1], code));

    // Đồ treo tường
    if (owned.has("wall_painting")) {
      const { center } = this.wallItem(WALL_SPOTS.wall_painting.tx, WALL_SPOTS.wall_painting.h - 26, 1.2, 26, 0xfff6e9, 0xa0561a);
      this.add.circle(center.x, center.y, 7, 0xe28b9b).setDepth(-899);
      this.add.rectangle(center.x, center.y + 7, 14, 5, 0xc9722e).setDepth(-899);
    }
    if (owned.has("wall_clock")) {
      const p = this.iso(WALL_SPOTS.wall_clock.tx, 0);
      const y = p.y - WALL_SPOTS.wall_clock.h;
      this.add.ellipse(p.x, y, 20, 22, 0xffffff).setStrokeStyle(3, 0x7a3e12).setDepth(-899);
      const hands = this.add.graphics().setDepth(-898);
      hands.lineStyle(2, 0x4a2b1a, 1).lineBetween(p.x, y, p.x, y - 7).lineBetween(p.x, y, p.x + 5, y + 2);
    }
    if (owned.has("wall_shelf")) {
      const { center } = this.wallItem(WALL_SPOTS.wall_shelf.tx, WALL_SPOTS.wall_shelf.h - 30, 1.4, 5, 0xa0561a, 0x7a3e12);
      for (let i = -1; i <= 1; i++) {
        this.add.rectangle(center.x + i * 11, center.y - 1 + i * 5.5 - 6, 7, 9, [0xffffff, 0xe28b9b, 0x8fb6e0][i + 1]).setDepth(-898);
      }
    }
    if (owned.has("decor_neon")) {
      const { center } = this.wallItem(WALL_SPOTS.decor_neon.tx, WALL_SPOTS.decor_neon.h - 20, 1.3, 20, 0x2b1d3a, 0xe28b9b);
      this.add
        .text(center.x, center.y, "Sweet", { fontFamily: "Baloo 2, sans-serif", fontSize: "11px", color: "#FFD1DC", fontStyle: "700" })
        .setOrigin(0.5)
        .setDepth(-898);
    }
    if (owned.has("wall_curtain")) {
      const g = this.add.graphics().setDepth(-997);
      const [p0, p1] = [this.skyPoly[0], this.skyPoly[1]];
      g.fillStyle(t.accent, 0.9);
      g.fillTriangle(p0.x, p0.y - 4, p0.x - 9, p0.y + 44, p0.x + 10, p0.y - 4);
      g.fillTriangle(p1.x, p1.y - 4, p1.x + 9, p1.y + 44, p1.x - 10, p1.y - 4);
    }

    // Đồ đặt sàn
    const plant = (spot: Pt, big: boolean) => {
      this.box(spot.tx, spot.ty, big ? 0.5 : 0.35, big ? 0.5 : 0.35, big ? 14 : 10, 0xc9722e);
      const c = this.iso(spot.tx, spot.ty);
      const top = c.y - (big ? 14 : 10);
      const leaves = this.add.graphics().setDepth(c.y + 5);
      leaves.fillStyle(0x6fa678, 1).fillCircle(c.x, top - (big ? 16 : 9), big ? 14 : 8);
      leaves.fillStyle(0x4f8a5c, 1).fillCircle(c.x - (big ? 8 : 5), top - (big ? 8 : 5), big ? 9 : 5);
      leaves.fillCircle(c.x + (big ? 8 : 5), top - (big ? 10 : 6), big ? 9 : 5);
    };
    if (owned.has("decor_plant")) plant(FLOOR_SPOTS.decor_plant, false);
    if (owned.has("floor_bigplant")) plant(FLOOR_SPOTS.floor_bigplant, true);
    if (owned.has("floor_cakecase")) {
      const s = FLOOR_SPOTS.floor_cakecase;
      this.box(s.tx, s.ty, 1.1, 0.7, 20, 0xc9722e);
      this.box(s.tx, s.ty, 1.0, 0.6, 38, 0xd6eefb, 1).setAlpha(0.75);
    }

    // Đồ treo trần
    if (owned.has("decor_lamp")) this.lamp(this.iso(3.5, 2.6), 0xe7b23c);
    if (owned.has("ceil_lantern") || this.cfg.theme === "theme_midautumn") {
      [this.iso(2.2, 1.2), this.iso(5.4, 3.4), this.iso(1.4, 4.2)].forEach((p) => this.lantern(p));
    }
    if (owned.has("ceil_garland") || this.cfg.theme === "theme_xmas") this.garland();
    if (this.cfg.theme === "theme_xmas") {
      const c = this.iso(7.2, 5.9);
      const tree = this.add.graphics().setDepth(c.y + 10);
      tree.fillStyle(0x2e7d32, 1).fillTriangle(c.x, c.y - 52, c.x - 16, c.y - 10, c.x + 16, c.y - 10);
      tree.fillStyle(0x6d4c41, 1).fillRect(c.x - 3, c.y - 10, 6, 8);
      tree.fillStyle(0xffd54f, 1).fillCircle(c.x, c.y - 54, 3);
    }
  }

  private lamp(p: { x: number; y: number }, color: number) {
    const g = this.add.graphics().setDepth(5000);
    const y = p.y - 150;
    g.lineStyle(1.5, 0x7a3e12, 1).lineBetween(p.x, 0, p.x, y);
    g.fillStyle(color, 1).fillEllipse(p.x, y + 6, 22, 12);
    g.fillStyle(0xffe9a8, 0.25).fillEllipse(p.x, y + 26, 40, 22);
  }

  private lantern(p: { x: number; y: number }) {
    const g = this.add.graphics().setDepth(5000);
    const y = p.y - 150;
    g.lineStyle(1.5, 0x7a3e12, 1).lineBetween(p.x, 0, p.x, y);
    g.fillStyle(0xc62828, 1).fillEllipse(p.x, y + 9, 16, 18);
    g.fillStyle(0xffd54f, 1).fillRect(p.x - 5, y, 10, 2).fillRect(p.x - 5, y + 17, 10, 2);
  }

  private garland() {
    const g = this.add.graphics().setDepth(5001);
    const colors = [0xe28b9b, 0x6fa678, 0xe7b23c, 0x7c6bd6];
    const a = this.iso(0.2, 0);
    const b = this.iso(GRID_W - 0.2, 0);
    const n = 10;
    for (let i = 0; i < n; i++) {
      const x = a.x + ((b.x - a.x) * (i + 0.5)) / n;
      const y = a.y - WALL_H + 6 + ((b.y - a.y) * (i + 0.5)) / n;
      g.fillStyle(colors[i % 4], 1).fillTriangle(x - 5, y, x + 5, y, x, y + 10);
    }
    g.lineStyle(1, 0x7a3e12, 1).lineBetween(a.x, a.y - WALL_H + 6, b.x, b.y - WALL_H + 6);
  }

  // ---------------------------------------------------------------- khách
  private headKey(image: string) {
    return `cust:${image}`;
  }

  /** Cắt ảnh chân dung thành hình tròn (tạo 1 lần cho mỗi ảnh). */
  private roundKey(image: string) {
    const key = `round:${image}`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(this.headKey(image)).getSourceImage() as HTMLImageElement;
    const size = 96;
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return null;
    const ctx = tex.getContext();
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#FFF6E9";
    ctx.fillRect(0, 0, size, size);
    const scale = Math.max(size / src.width, size / src.height);
    const w = src.width * scale;
    const h = src.height * scale;
    ctx.drawImage(src, (size - w) / 2, (size - h) / 2 - size * 0.04, w, h);
    ctx.restore();
    tex.refresh();
    return key;
  }

  // Khách hiển thị dạng 2D "standee": avatar tròn (ảnh chân dung hoặc "?") + tên, đổ bóng dưới chân.
  private makeActor(c: SceneCustomer, at: Pt) {
    const p = this.iso(at.tx, at.ty);
    const box = this.add.container(p.x, p.y);
    box.add(this.add.ellipse(0, 0, 22, 8, 0x000000, 0.18));
    box.add(this.add.rectangle(0, -9, 3, 14, 0x7a3e12, 0.5)); // chân đế
    const ring = this.add.circle(0, HEAD_Y, AVATAR_R + 3, RING[c.status]);
    box.add(ring);

    const headKey = c.image ? this.headKey(c.image) : null;
    const round = headKey && this.textures.exists(headKey) ? this.roundKey(c.image!) : null;
    if (round) {
      box.add(this.add.image(0, HEAD_Y, round).setDisplaySize(AVATAR_R * 2, AVATAR_R * 2));
    } else {
      box.add(this.add.circle(0, HEAD_Y, AVATAR_R, BG[c.look % 4]));
      box.add(
        this.add
          .text(0, HEAD_Y, "?", { fontFamily: "Baloo 2, sans-serif", fontSize: "17px", color: "#7A3E12", fontStyle: "700" })
          .setOrigin(0.5),
      );
    }
    const short = c.name.split(" ").pop() ?? c.name;
    box.add(
      this.add
        .text(0, HEAD_Y + AVATAR_R + 9, short, {
          fontFamily: "Nunito, sans-serif",
          fontSize: "10px",
          color: "#4A2B1A",
          fontStyle: "800",
          backgroundColor: "#FFFFFFCC",
          padding: { x: 3, y: 0 },
        })
        .setOrigin(0.5),
    );
    box.setDepth(p.y);
    const actor: Actor = { box, ring, status: c.status, target: `${at.tx},${at.ty}` };
    this.actors.set(c.id, actor);
    return actor;
  }

  private walk(actor: Actor, path: Pt[], onDone?: () => void) {
    this.tweens.killTweensOf(actor.box);
    const steps = path.map((pt) => this.iso(pt.tx, pt.ty));
    const run = (i: number) => {
      if (i >= steps.length) return onDone?.();
      const s = steps[i];
      const dist = Phaser.Math.Distance.Between(actor.box.x, actor.box.y, s.x, s.y);
      this.tweens.add({
        targets: actor.box,
        x: s.x,
        y: s.y,
        duration: Math.max(80, (dist / SPEED) * 1000),
        onUpdate: () => actor.box.setDepth(actor.box.y),
        onComplete: () => run(i + 1),
      });
    };
    // nhún nhẹ khi đi
    this.tweens.add({ targets: actor.box, scaleY: 0.94, yoyo: true, repeat: Math.max(1, steps.length * 2), duration: 160 });
    run(0);
  }

  private bubble(actor: Actor, text: string, color: string) {
    const t = this.add
      .text(actor.box.x, actor.box.y + HEAD_Y - AVATAR_R - 14, text, { fontFamily: "Nunito, sans-serif", fontSize: "12px", color, fontStyle: "800", backgroundColor: "#ffffff", padding: { x: 4, y: 1 } })
      .setOrigin(0.5)
      .setDepth(6000);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, delay: 700, duration: 700, onComplete: () => t.destroy() });
  }

  /** Nạp ảnh chân dung khách còn thiếu rồi đồng bộ. */
  sync(list: SceneCustomer[]) {
    if (!this.ready) {
      this.pending = list;
      return;
    }
    const missing = list.filter((c) => c.image && !this.loaded.has(c.image));
    if (missing.length) {
      missing.forEach((c) => {
        this.loaded.add(c.image!);
        this.load.image(this.headKey(c.image!), c.image!);
      });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.apply(list));
      this.load.start();
      return;
    }
    this.apply(list);
  }

  private apply(list: SceneCustomer[]) {
    const waiting = list.filter((c) => c.status === "waiting").sort((a, b) => a.order - b.order);
    const seated = list.filter((c) => c.status === "seated").sort((a, b) => a.order - b.order);
    const targets = new Map<string, Pt>();
    waiting.forEach((c, i) => targets.set(c.id, QUEUE[Math.min(i, QUEUE.length - 1)]));
    list.filter((c) => c.status === "cooking").forEach((c) => targets.set(c.id, COOKING_SPOT));
    seated.forEach((c, i) => targets.set(c.id, this.seats[i % this.seats.length]));

    // Khách rời đi
    for (const [id, actor] of this.actors) {
      if (targets.has(id)) continue;
      this.actors.delete(id);
      if (actor.status !== "seated") this.bubble(actor, "Chờ lâu quá!", "#B3261E");
      else this.bubble(actor, "Ngon!", "#3E7A4A");
      this.walk(actor, [DOOR_INSIDE, DOOR], () => actor.box.destroy());
    }

    // Khách mới / đổi chỗ
    for (const c of list) {
      const to = targets.get(c.id)!;
      const key = `${to.tx},${to.ty}`;
      let actor = this.actors.get(c.id);
      if (!actor) {
        const startAtSpot = this.firstSync;
        actor = this.makeActor(c, startAtSpot ? to : c.status === "seated" ? COOKING_SPOT : DOOR);
        if (!startAtSpot) this.walk(actor, c.status === "seated" ? [to] : [DOOR_INSIDE, to]);
      } else if (actor.target !== key) {
        this.walk(actor, [to]);
      }
      if (c.status === "seated" && actor.status !== "seated") this.bubble(actor, "Cảm ơn!", "#3E7A4A");
      if (actor.status !== c.status) actor.ring.setFillStyle(RING[c.status]);
      actor.status = c.status;
      actor.target = key;
    }
    this.firstSync = false;
  }
}
