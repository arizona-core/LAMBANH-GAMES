// Cảnh tiệm 2.5D isometric: tường, sàn, quầy, bàn ghế + đồ trang trí đã mua, khách đi lại.
// React gọi sync() mỗi giây với danh sách khách (server quyết định ai tới/đi/ngồi);
// scene chỉ diễn hoạt: đi từ cửa → xếp hàng → quầy → ghế ngồi → ra về.
import * as Phaser from "phaser";
import {
  CHEF,
  COOKING_SPOT,
  COUNTER,
  DISPLAY_SPOT,
  DOOR,
  DOOR_INSIDE,
  FLOOR_SPOTS,
  GRID_H,
  GRID_W,
  OVEN_SPOT,
  QUEUE,
  TABLE_SPOTS,
  THEMES,
  WALL_SPOTS,
  seatOffsets,
  tierOf,
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
const WALL_T = 0.16; // độ dày tường (ô), lộ ra ở mặt cắt đầu tường + mặt trên
const SLAB = 10; // độ dày khối nền dưới sàn (px)
const SHADOW = 0x3a2412; // bóng đổ tông nâu ấm (không dùng đen)
const SPEED = 70; // px/giây

/** Nguồn sáng: quầng tròn bán kính r px, flat = tỉ lệ cao/rộng (0.5 = nằm trên sàn), power = độ sáng lúc tối. */
type Light = { x: number; y: number; r: number; color: number; flat: number; power: number; nightOnly?: boolean };

function skyColor(hour: number): number {
  if (hour < 5) return 0x27305a;
  if (hour < 8) return 0xf7b28a;
  if (hour < 16) return 0x9ed3f3;
  if (hour < 19) return 0xf2956b;
  return 0x27305a;
}

/** Bao lồi của tập điểm (thuật toán monotone chain), dùng vẽ luồng sáng từ cửa sổ xuống sàn. */
function hull(points: { x: number; y: number }[]) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: typeof pts) => {
    const out: typeof pts = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
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
  private shadows!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Graphics;
  private glowSpots: Light[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private roomPoly: Phaser.Geom.Point[] = [];
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
    this.glowSpots = [];
    this.glows = [];
    this.firstSync = true;
    this.ready = false;
  }

  preload() {
    this.load.setCORS("anonymous");
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

    // Lớp ánh sáng: vệt nắng + bóng đổ nằm trên sàn (dưới đồ vật); màn đêm + quầng đèn phủ lên trên cùng.
    // Nắng/quầng đèn dùng chế độ cộng sáng (ADD) để sáng lên được cả trên sàn màu nhạt.
    this.sun = this.add.graphics().setDepth(-945).setBlendMode(Phaser.BlendModes.ADD);
    this.shadows = this.add.graphics().setDepth(-940);
    this.night = this.add.graphics().setDepth(5003);

    this.drawRoom();
    this.drawCounter();
    this.drawDecor();
    const mid = this.iso(GRID_W / 2, GRID_H / 2);
    this.glowSpots.push({ x: mid.x, y: mid.y, r: this.tw * 3.6, color: 0xffd9a0, flat: 0.5, power: 0.3, nightOnly: true }); // đèn trần
    this.glows = this.glowSpots.map((l) => {
      const img = this.add.image(l.x, l.y, this.glowKey(l.color));
      return img.setDisplaySize(l.r * 2, l.r * 2 * l.flat).setBlendMode(Phaser.BlendModes.ADD).setDepth(5004);
    });
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
  private quad(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], color: number, alpha = 1) {
    g.fillStyle(color, alpha);
    g.fillPoints(pts.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  }

  /** Điểm 3D (ô x, ô y, cao z px) → toạ độ màn hình. */
  private p3(x: number, y: number, z: number) {
    const q = this.iso(x, y);
    return { x: q.x, y: q.y - z };
  }

  /** Vỏ phòng kiểu mô hình cắt lớp: khối nền dày SLAB px dưới sàn, tường dày WALL_T ô (mặt cắt + mặt trên). */
  private drawShell(g: Phaser.GameObjects.Graphics) {
    const t = this.theme;
    const [W, H, T] = [GRID_W, GRID_H, WALL_T];
    // Khối nền: mặt trước-trái (hướng y+) tối hơn mặt trước-phải (hướng x+), giống hộp đồ vật.
    this.quad(g, [this.p3(-T, H, 0), this.p3(W, H, 0), this.p3(W, H, -SLAB), this.p3(-T, H, -SLAB)], shade(t.floorB, 0.62));
    this.quad(g, [this.p3(W, -T, 0), this.p3(W, H, 0), this.p3(W, H, -SLAB), this.p3(W, -T, -SLAB)], shade(t.floorB, 0.76));
    // Mặt cắt ở đầu 2 bức tường
    this.quad(g, [this.p3(W, -T, 0), this.p3(W, 0, 0), this.p3(W, 0, WALL_H), this.p3(W, -T, WALL_H)], shade(t.wall, 0.82));
    this.quad(g, [this.p3(-T, H, 0), this.p3(0, H, 0), this.p3(0, H, WALL_H), this.p3(-T, H, WALL_H)], shade(t.wallSide, 0.72));
    // Mặt trên tường (hình chữ L ôm góc phòng)
    const cap = [this.p3(W, 0, WALL_H), this.p3(W, -T, WALL_H), this.p3(-T, -T, WALL_H), this.p3(-T, H, WALL_H), this.p3(0, H, WALL_H), this.p3(0, 0, WALL_H)];
    this.quad(g, cap, shade(t.wall, 1.08));
    g.lineStyle(1, shade(t.wallSide, 0.7), 0.5).strokePoints(cap.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    // Viền sáng mép sàn, tách sàn khỏi khối nền
    g.lineStyle(1.5, 0xffffff, 0.35);
    g.lineBetween(this.p3(0, H, 0).x, this.p3(0, H, 0).y, this.p3(W, H, 0).x, this.p3(W, H, 0).y);
    g.lineBetween(this.p3(W, 0, 0).x, this.p3(W, 0, 0).y, this.p3(W, H, 0).x, this.p3(W, H, 0).y);

    // Bóng phòng (để phủ màn đêm đúng hình căn phòng)
    this.roomPoly = [
      this.p3(-T, -T, WALL_H), this.p3(W, -T, WALL_H), this.p3(W, -T, -SLAB),
      this.p3(W, H, -SLAB), this.p3(-T, H, -SLAB), this.p3(-T, H, WALL_H),
    ].map((p) => new Phaser.Geom.Point(p.x, p.y));
  }

  /** Bóng góc: sàn tối dần về chân tường, chân tường và góc phòng tối nhẹ. */
  private drawOcclusion(g: Phaser.GameObjects.Graphics) {
    const [W, H] = [GRID_W, GRID_H];
    for (let i = 1; i <= 4; i++) {
      const b = i * 0.14;
      const z = i * 4;
      this.quad(g, [this.p3(0, 0, 0), this.p3(W, 0, 0), this.p3(W, b, 0), this.p3(0, b, 0)], SHADOW, 0.035);
      this.quad(g, [this.p3(0, 0, 0), this.p3(b, 0, 0), this.p3(b, H, 0), this.p3(0, H, 0)], SHADOW, 0.035);
      this.quad(g, [this.p3(0, 0, 0), this.p3(W, 0, 0), this.p3(W, 0, z), this.p3(0, 0, z)], SHADOW, 0.03);
      this.quad(g, [this.p3(0, 0, 0), this.p3(0, H, 0), this.p3(0, H, z), this.p3(0, 0, z)], SHADOW, 0.03);
    }
    for (let i = 1; i <= 3; i++) {
      const b = i * 0.12;
      this.quad(g, [this.p3(0, 0, 0), this.p3(b, 0, 0), this.p3(b, 0, WALL_H), this.p3(0, 0, WALL_H)], SHADOW, 0.03);
      this.quad(g, [this.p3(0, 0, 0), this.p3(0, b, 0), this.p3(0, b, WALL_H), this.p3(0, 0, WALL_H)], SHADOW, 0.03);
    }
  }

  /** Bóng đổ mềm dưới đồ vật đặt sàn (lệch nhẹ về phía xa cửa sổ). */
  private dropShadow(x0: number, y0: number, w: number, d: number) {
    const [ox, oy] = [0.06, 0.1];
    for (const [e, a] of [[0.12, 0.07], [0.04, 0.09]]) {
      this.quad(
        this.shadows,
        [this.p3(x0 - e + ox, y0 - e + oy, 0), this.p3(x0 + w + e + ox, y0 - e + oy, 0), this.p3(x0 + w + e + ox, y0 + d + e + oy, 0), this.p3(x0 - e + ox, y0 + d + e + oy, 0)],
        SHADOW,
        a,
      );
    }
  }

  private drawRoom() {
    const t = this.theme;
    const g = this.add.graphics().setDepth(-1000);
    this.drawShell(g);

    // Sàn: caro, hoặc ván gỗ chạy dọc trục x (theme gỗ)
    if (t.floor === "planks") {
      for (let y = 0; y < GRID_H * 2; y++) {
        const y0 = y / 2;
        const y1 = y0 + 0.5;
        this.quad(g, [this.iso(0, y0), this.iso(GRID_W, y0), this.iso(GRID_W, y1), this.iso(0, y1)], y % 2 ? t.floorA : t.floorB);
      }
      g.lineStyle(1, shade(t.floorB, 0.75), 0.6);
      for (let y = 0; y < GRID_H * 2; y++) {
        for (let x = (y % 3) + 0.5; x < GRID_W; x += 3) {
          const a = this.iso(x, y / 2);
          const b = this.iso(x, y / 2 + 0.5);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    } else {
      for (let x = 0; x < GRID_W; x++) {
        for (let y = 0; y < GRID_H; y++) {
          this.quad(
            g,
            [this.iso(x, y), this.iso(x + 1, y), this.iso(x + 1, y + 1), this.iso(x, y + 1)],
            (x + y) % 2 ? t.floorA : t.floorB,
          );
        }
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
    this.drawWallpaper(g);
    this.drawOcclusion(g);

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
    if (this.cfg.theme === "theme_midautumn") {
      // Trăng rằm to tròn trong khung cửa sổ.
      this.sky.fillStyle(0xfff3c4, 1).fillCircle(c.x - 16, c.y + 20, 11);
      this.sky.fillStyle(0xffe08a, 0.8).fillCircle(c.x - 19, c.y + 17, 3).fillCircle(c.x - 12, c.y + 24, 2);
    } else {
      this.sky.fillStyle(night ? 0xf4f1de : 0xffd76a, 1).fillCircle(c.x - 10, c.y + 14, 5);
    }
    if (this.cfg.theme === "theme_xmas") {
      // Tuyết đọng dưới khung cửa sổ.
      const [, , p2, p3] = this.skyPoly;
      this.sky.fillStyle(0xffffff, 1);
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        this.sky.fillCircle(p3.x + (p2.x - p3.x) * f, p3.y + (p2.y - p3.y) * f - 2, 4);
      }
    }
    this.drawLight(hour);
  }

  /** Texture quầng sáng tròn mờ dần ra mép (tạo 1 lần cho mỗi màu; vẽ sẵn màu vì canvas renderer không tint được). */
  private glowKey(color: number) {
    const key = `glow:${color}`;
    if (this.textures.exists(key)) return key;
    const size = 128;
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return key;
    const ctx = tex.getContext();
    const c = Phaser.Display.Color.IntegerToColor(color);
    const rgba = (a: number) => `rgba(${c.red}, ${c.green}, ${c.blue}, ${a})`;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgba(1));
    grad.addColorStop(0.45, rgba(0.45));
    grad.addColorStop(1, rgba(0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
    return key;
  }

  /** Ánh sáng theo giờ game: ban ngày nắng rọi qua cửa sổ xuống sàn; tối thì tiệm tối lại, đèn toả quầng. */
  private drawLight(hour: number) {
    this.sun.clear();
    this.night.clear();
    const night = hour < 6 || hour >= 19;
    const dusk = hour >= 17 && hour < 19;

    if (!night) {
      // Cửa sổ ở tường tx = 0 (ty 1.4 → 3.4, cao 22 → 62 px). Mỗi điểm trên khung cửa chiếu xuống sàn:
      // càng cao thì rọi càng xa vào trong; nắng sớm/chiều chiếu xa và xiên hơn nắng trưa.
      const low = Math.min(1, Math.abs(hour + 0.5 - 12.5) / 6.5); // 0 = trưa, 1 = sáng sớm / chiều tối
      const reach = 0.045 + low * 0.03; // số ô rọi vào trên mỗi px chiều cao
      const skew = Phaser.Math.Clamp((hour - 12.5) / 18, -0.3, 0.3);
      const onFloor = (ty: number, z: number) => ({ x: z * reach, y: ty + z * reach * skew });
      const color = low > 0.6 ? 0xffb070 : 0xffe2a8;
      const alpha = 0.17 - low * 0.04;
      // 2 ô kính, chừa vệt bóng của thanh giữa khung cửa (ty 2.4)
      for (const [y0, y1] of [[1.45, 2.35], [2.45, 3.35]]) {
        const patch = [onFloor(y0, 22), onFloor(y1, 22), onFloor(y1, 62), onFloor(y0, 62)];
        const cx = patch.reduce((s, p) => s + p.x, 0) / 4;
        const cy = patch.reduce((s, p) => s + p.y, 0) / 4;
        // Mép mềm: 3 lớp phóng to dần quanh tâm, lớp ngoài mờ nhất (chế độ cộng sáng nên cộng dồn ở giữa).
        for (const [grow, a] of [[1.14, 0.3], [1.06, 0.35], [1, 0.5]]) {
          const pts = patch.map((p) => this.p3(cx + (p.x - cx) * grow, cy + (p.y - cy) * grow, 0));
          this.quad(this.sun, pts, color, alpha * a * 2);
        }
        // Luồng sáng mờ trong không khí: từ ô kính trên tường tới vệt nắng trên sàn.
        const pane = [this.p3(0, y0, 22), this.p3(0, y1, 22), this.p3(0, y1, 62), this.p3(0, y0, 62)];
        const floor = patch.map((p) => this.p3(p.x, p.y, 0));
        this.quad(this.sun, hull([...pane, ...floor]), color, alpha * 0.35);
      }
    }

    if (night || dusk) {
      this.night.fillStyle(night ? 0x1b2550 : 0x7a3e12, night ? 0.22 : 0.07).fillPoints(this.roomPoly, true);
    }
    const k = night ? 1 : dusk ? 0.6 : 0.25;
    this.glowSpots.forEach((l, i) => {
      this.glows[i]?.setVisible(night || !l.nightOnly).setAlpha(l.power * k);
    });
  }

  /** Hộp isometric có đáy w×d ô, tâm tại (tx, ty), cao h px. Đặt sàn (z0 = 0) thì đổ bóng xuống sàn. */
  private box(tx: number, ty: number, w: number, d: number, h: number, color: number, depthBias = 0, z0 = 0, shadow = z0 === 0) {
    const g = this.add.graphics();
    const x0 = tx - w / 2;
    const y0 = ty - d / 2;
    if (shadow) this.dropShadow(x0, y0, w, d);
    const p = (x: number, y: number, z: number) => {
      const q = this.iso(x, y);
      return { x: q.x, y: q.y - z - z0 };
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
    this.box(COUNTER.tx, COUNTER.ty, COUNTER.len, 0.8, 27, t.counterTop, 0, 0, false).setAlpha(0.35).setDepth(depth + 0.1);
    // Máy tính tiền trên quầy
    this.box(COUNTER.tx + 1.1, COUNTER.ty, 0.35, 0.35, 40, 0x4a4a4a, 0, 0, false).setDepth(depth + 0.2);
    const owned = this.cfg.decor;
    this.drawDisplay(tierOf(owned, "display"), depth + 0.2);
    this.drawOven(tierOf(owned, "oven"));

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
      this.box(spot.tx - 0.85, spot.ty, 0.2, 1.8, 26, shade(wood, 0.9), -2, 0, false);
      this.box(spot.tx + 0.35, spot.ty, 0.6, 0.6, 12, 0xa0561a);
    } else if (kind === "seat_bar") {
      this.box(spot.tx, spot.ty, 2.2, 0.5, 24, 0x6d4c41);
    } else {
      this.box(spot.tx, spot.ty, 0.8, 0.8, 16, wood);
      this.box(spot.tx, spot.ty, 0.18, 0.18, 24, 0xfff6e9, 3, 0, false); // bình hoa nhỏ
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
      this.box(s.tx, s.ty, 1.0, 0.6, 38, 0xd6eefb, 1, 0, false).setAlpha(0.75);
    }

    // Đồ treo trần
    if (owned.has("decor_lamp")) this.lamp(this.iso(3.5, 2.6), 0xe7b23c);
    if (owned.has("ceil_lantern") || this.cfg.theme === "theme_midautumn") {
      [this.iso(2.2, 1.2), this.iso(5.4, 3.4), this.iso(1.4, 4.2)].forEach((p) => this.lantern(p));
    }
    if (owned.has("ceil_garland") || this.cfg.theme === "theme_xmas") this.garland();
    this.drawThemeExtras();
  }

  // Vật treo trần: không để lọt khỏi mép trên khung hình (giống hanging()).
  private lamp(p: { x: number; y: number }, color: number) {
    const g = this.add.graphics().setDepth(5000);
    const y = Math.max(34, p.y - 150);
    g.lineStyle(1.5, 0x7a3e12, 1).lineBetween(p.x, 0, p.x, y);
    g.fillStyle(color, 1).fillEllipse(p.x, y + 6, 22, 12);
    this.glowSpots.push({ x: p.x, y: y + 9, r: 18, color: 0xffe9a8, flat: 1, power: 0.8 });
    this.glowSpots.push({ x: p.x, y: p.y, r: this.tw * 1.6, color: 0xffd98a, flat: 0.5, power: 0.45 }); // quầng sáng trên sàn
  }

  private lantern(p: { x: number; y: number }) {
    const g = this.add.graphics().setDepth(5000);
    const y = Math.max(34, p.y - 150);
    this.glowSpots.push({ x: p.x, y: p.y, r: this.tw * 0.9, color: 0xff8a65, flat: 0.5, power: 0.4 });
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

  // ---------------------------------------------------------------- lò nướng & tủ bánh (theo bậc nâng cấp)
  /** Điểm trên mặt trước (hướng y+) của hộp: u = 0..1 theo chiều dài, z = độ cao px. */
  private frontPt(tx: number, ty: number, w: number, d: number, u: number, z: number) {
    const q = this.iso(tx - w / 2 + u * w, ty + d / 2);
    return { x: q.x, y: q.y - z };
  }

  private frontPanel(
    tx: number,
    ty: number,
    w: number,
    d: number,
    u0: number,
    u1: number,
    zA: number,
    zB: number,
    color: number,
    depth: number,
    alpha = 1,
  ) {
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(color, alpha);
    g.fillPoints(
      [
        this.frontPt(tx, ty, w, d, u0, zA),
        this.frontPt(tx, ty, w, d, u1, zA),
        this.frontPt(tx, ty, w, d, u1, zB),
        this.frontPt(tx, ty, w, d, u0, zB),
      ].map((p) => new Phaser.Geom.Point(p.x, p.y)),
      true,
    );
    return g;
  }

  /** Quầng sáng hắt ra từ cửa lò (giữa mặt trước, cao z px). */
  private ovenLight(w: number, d: number, z: number, color: number, size: number) {
    const p = this.frontPt(OVEN_SPOT.tx, OVEN_SPOT.ty, w, d, 0.5, z);
    this.glowSpots.push({ x: p.x, y: p.y, r: this.tw * size, color, flat: 0.8, power: 0.55 });
  }

  private flicker(target: Phaser.GameObjects.GameObject, min: number, ms: number) {
    this.tweens.add({ targets: target, alpha: { from: 1, to: min }, yoyo: true, repeat: -1, duration: ms });
  }

  private drawOven(tier: number) {
    const s = OVEN_SPOT;

    if (tier === 0) {
      // Lò cơ bản: nhỏ, xám.
      const [w, d] = [0.7, 0.6];
      const depth = this.box(s.tx, s.ty, w, d, 30, 0xa7a7a7, -2).depth;
      this.frontPanel(s.tx, s.ty, w, d, 0.15, 0.85, 5, 22, 0x4a4a4a, depth + 0.1);
      this.frontPanel(s.tx, s.ty, w, d, 0.3, 0.7, 25, 27, 0xe7b23c, depth + 0.1);
      return;
    }
    if (tier === 1) {
      // Lò đối lưu: inox, cửa kính, đèn trong lò.
      const [w, d] = [0.8, 0.65];
      const depth = this.box(s.tx, s.ty, w, d, 40, 0xcfd8dc, -2).depth;
      this.ovenLight(w, d, 18, 0xffa94d, 0.6);
      this.frontPanel(s.tx, s.ty, w, d, 0.1, 0.9, 6, 30, 0x37474f, depth + 0.1);
      this.flicker(this.frontPanel(s.tx, s.ty, w, d, 0.2, 0.8, 10, 26, 0xffa94d, depth + 0.2, 0.55), 0.35, 900);
      for (const u of [0.25, 0.5, 0.75]) {
        const k = this.frontPt(s.tx, s.ty, w, d, u, 35);
        this.add.circle(k.x, k.y, 2.2, 0x546e7a).setDepth(depth + 0.2);
      }
      return;
    }
    if (tier === 2) {
      // Lò gạch: vòm gạch đỏ, miệng lò có lửa bập bùng.
      const [w, d] = [1.0, 0.75];
      const depth = this.box(s.tx, s.ty, w, d, 26, 0xb5532e, -2).depth;
      this.ovenLight(w, d, 10, 0xff7a1a, 0.75);
      const top = this.iso(s.tx, s.ty);
      const dome = this.add.graphics().setDepth(depth + 0.05);
      dome.fillStyle(0xa3472a, 1).fillEllipse(top.x, top.y - 30, this.tw * 0.95, 34);
      dome.fillStyle(0xc0603a, 1).fillEllipse(top.x - 3, top.y - 34, this.tw * 0.7, 20);
      const bricks = this.add.graphics().setDepth(depth + 0.1);
      bricks.lineStyle(1, 0x7a2f19, 0.8);
      for (const z of [8, 16]) {
        const a = this.frontPt(s.tx, s.ty, w, d, 0, z);
        const b = this.frontPt(s.tx, s.ty, w, d, 1, z);
        bricks.lineBetween(a.x, a.y, b.x, b.y);
      }
      this.frontPanel(s.tx, s.ty, w, d, 0.3, 0.7, 3, 20, 0x2b1a12, depth + 0.15);
      this.flicker(this.frontPanel(s.tx, s.ty, w, d, 0.36, 0.64, 3, 13, 0xff7a1a, depth + 0.2), 0.45, 260);
      this.flicker(this.frontPanel(s.tx, s.ty, w, d, 0.43, 0.57, 3, 17, 0xffd54f, depth + 0.25), 0.3, 340);
      return;
    }
    // Lò thông minh: cao, đen nhám, màn hình cảm ứng phát sáng.
    const [w, d] = [0.85, 0.7];
    const depth = this.box(s.tx, s.ty, w, d, 52, 0x2f3b45, -2).depth;
    this.ovenLight(w, d, 22, 0xffb74d, 0.55);
    this.frontPanel(s.tx, s.ty, w, d, 0.1, 0.9, 6, 34, 0x1b252c, depth + 0.1);
    this.flicker(this.frontPanel(s.tx, s.ty, w, d, 0.18, 0.82, 10, 30, 0xffb74d, depth + 0.2, 0.4), 0.5, 1200);
    this.flicker(this.frontPanel(s.tx, s.ty, w, d, 0.2, 0.8, 39, 46, 0x4dd0e1, depth + 0.2), 0.4, 700);
  }

  private cake(tx: number, ty: number, z0: number, color: number, depth: number) {
    this.box(tx, ty, 0.2, 0.2, 7, color, 0, z0).setDepth(depth);
    this.box(tx, ty, 0.2, 0.2, 2, 0xfffaf0, 0, z0 + 7).setDepth(depth + 0.01);
    const c = this.iso(tx, ty);
    this.add.circle(c.x, c.y - z0 - 11, 1.8, 0xd32f2f).setDepth(depth + 0.02);
  }

  private drawDisplay(tier: number, depth: number) {
    const s = DISPLAY_SPOT;
    const z0 = 27; // mặt quầy
    const cakes = [0xf8bbd0, 0x8d6e63, 0xfff3c4, 0xc5e1a5, 0xffccbc, 0xd1c4e9];
    const row = (n: number, z: number) => {
      for (let i = 0; i < n; i++) {
        this.cake(s.tx - 0.35 + (0.7 * i) / Math.max(1, n - 1), s.ty, z, cakes[(i + z) % cakes.length], depth + 0.02);
      }
    };

    if (tier === 0) {
      // Khay bánh đơn giản.
      this.box(s.tx, s.ty, 0.6, 0.45, 4, 0xfff6e9, 0, z0).setDepth(depth);
      row(2, z0 + 4);
      return;
    }
    if (tier === 3) {
      // Quầy cao cấp: mặt đá cẩm thạch viền vàng.
      this.box(COUNTER.tx, COUNTER.ty, COUNTER.len, 0.8, 2, 0xf5f0e6, 0, 26).setDepth(depth - 0.05);
      const a = this.frontPt(COUNTER.tx, COUNTER.ty, COUNTER.len, 0.8, 0, 24);
      const b = this.frontPt(COUNTER.tx, COUNTER.ty, COUNTER.len, 0.8, 1, 24);
      this.add.graphics().setDepth(depth - 0.04).lineStyle(3, 0xe7b23c, 1).lineBetween(a.x, a.y, b.x, b.y);
    }
    const [w, d, h, tint] =
      tier === 1 ? [1.0, 0.5, 20, 0xd6eefb] : tier === 2 ? [1.1, 0.55, 32, 0xbfe3f5] : [1.2, 0.6, 32, 0xfff8e1];
    this.box(s.tx, s.ty, w, d, 3, tier === 3 ? 0xe7b23c : 0xeceff1, 0, z0).setDepth(depth);
    row(3, z0 + 3);
    if (tier >= 2) {
      this.box(s.tx, s.ty, w, d, 2, 0xffffff, 0, z0 + 16).setDepth(depth + 0.03).setAlpha(0.9);
      row(3, z0 + 18);
    }
    this.box(s.tx, s.ty, w, d, h, tint, 0, z0).setDepth(depth + 0.1).setAlpha(0.42);
    const glass = this.iso(s.tx, s.ty);
    this.glowSpots.push({ x: glass.x, y: glass.y - z0 - h / 2, r: this.tw * 0.9, color: 0xfff3c4, flat: 0.8, power: 0.4 });
    // Dải đèn LED (bậc 1–2), viền vàng lấp lánh (bậc 3)
    const light = this.box(s.tx, s.ty, w, 0.06, 2, tier === 3 ? 0xffd54f : 0xfff59d, 0, z0 + h).setDepth(depth + 0.12);
    this.flicker(light, 0.5, tier === 3 ? 500 : 1400);
    if (tier === 3) {
      const c = this.iso(s.tx + 0.4, s.ty);
      const star = this.add.star(c.x, c.y - z0 - h - 6, 4, 2, 6, 0xffffff).setDepth(depth + 0.2);
      this.tweens.add({ targets: star, scale: { from: 0.4, to: 1.2 }, alpha: { from: 1, to: 0 }, repeat: -1, duration: 900 });
    }
  }

  // ---------------------------------------------------------------- theme: giấy dán tường + đồ trang trí riêng
  /** Điểm trên tường trái (ty = 0) tại x, cao z px. */
  private wallL(x: number, z: number) {
    const p = this.iso(x, 0);
    return { x: p.x, y: p.y - z };
  }

  /** Điểm trên tường phải (tx = 0) tại y, cao z px. */
  private wallR(y: number, z: number) {
    const p = this.iso(0, y);
    return { x: p.x, y: p.y - z };
  }

  /** Chỗ cửa sổ / cửa ra vào trên tường phải → không vẽ hoạ tiết đè lên. */
  private onOpening(y: number, z: number) {
    return (y > 1.3 && y < 3.5 && z > 18 && z < 66) || (y > 4.6 && y < 5.8 && z < 62);
  }

  private drawWallpaper(g: Phaser.GameObjects.Graphics) {
    const theme = this.cfg.theme;
    if (theme === "theme_pastel") {
      // Chấm bi trắng trên tường hồng.
      g.fillStyle(0xffffff, 0.55);
      for (let x = 0.5; x < GRID_W; x += 0.8) {
        for (let z = 16, row = 0; z < WALL_H - 6; z += 16, row++) {
          const p = this.wallL(x + (row % 2) * 0.4, z);
          g.fillCircle(p.x, p.y, 2.6);
        }
      }
      for (let y = 0.4; y < GRID_H; y += 0.8) {
        for (let z = 16, row = 0; z < WALL_H - 6; z += 16, row++) {
          const yy = y + (row % 2) * 0.4;
          if (this.onOpening(yy, z)) continue;
          const p = this.wallR(yy, z);
          g.fillCircle(p.x, p.y, 2.6);
        }
      }
    } else if (theme === "theme_wood") {
      // Ván gỗ dọc + xà gỗ trên đỉnh tường.
      g.lineStyle(1.5, 0x9c7650, 0.7);
      for (let x = 0.5; x < GRID_W; x += 0.5) {
        const a = this.wallL(x, 0);
        const b = this.wallL(x, WALL_H);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (let y = 0.5; y < GRID_H; y += 0.5) {
        const a = this.wallR(y, 0);
        const b = this.wallR(y, WALL_H);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      const beam = 0x5d4037;
      this.quad(g, [this.wallL(0, WALL_H - 9), this.wallL(GRID_W, WALL_H - 9), this.wallL(GRID_W, WALL_H), this.wallL(0, WALL_H)], beam);
      this.quad(g, [this.wallR(0, WALL_H - 9), this.wallR(GRID_H, WALL_H - 9), this.wallR(GRID_H, WALL_H), this.wallR(0, WALL_H)], shade(beam, 0.85));
    } else if (theme === "theme_midautumn" || theme === "theme_xmas") {
      // Ốp chân tường: đỏ viền vàng (Trung Thu) / sọc kẹo gậy đỏ trắng (Giáng sinh).
      const xmas = theme === "theme_xmas";
      const stripe = (i: number) => (xmas ? (i % 2 ? 0xffffff : 0xc62828) : 0xb71c1c);
      for (let i = 0; i < GRID_W * 4; i++) {
        const x = i / 4;
        this.quad(g, [this.wallL(x, 0), this.wallL(x + 0.25, 0), this.wallL(x + 0.25, 16), this.wallL(x, 16)], stripe(i));
      }
      for (let i = 0; i < GRID_H * 4; i++) {
        const y = i / 4;
        if (y > 4.6 && y < 5.8) continue;
        this.quad(g, [this.wallR(y, 0), this.wallR(y + 0.25, 0), this.wallR(y + 0.25, 16), this.wallR(y, 16)], shade(stripe(i), 0.92));
      }
      g.lineStyle(2, xmas ? 0x2e7d32 : 0xffc107, 1);
      g.lineBetween(this.wallL(0, 16).x, this.wallL(0, 16).y, this.wallL(GRID_W, 16).x, this.wallL(GRID_W, 16).y);
      g.lineBetween(this.wallR(0, 16).x, this.wallR(0, 16).y, this.wallR(4.6, 16).x, this.wallR(4.6, 16).y);
    }
  }

  /** Dây cờ (tam giác hoặc trái tim) dọc đỉnh tường phải. */
  private bunting(colors: number[], hearts = false) {
    const g = this.add.graphics().setDepth(5001);
    const z = WALL_H - 5;
    const n = 12;
    const a = this.wallR(0.2, z);
    const b = this.wallR(GRID_H - 0.2, z);
    g.lineStyle(1, 0x7a3e12, 1).lineBetween(a.x, a.y, b.x, b.y);
    for (let i = 0; i < n; i++) {
      const p = this.wallR(0.2 + ((GRID_H - 0.4) * (i + 0.5)) / n, z);
      g.fillStyle(colors[i % colors.length], 1);
      if (hearts) {
        g.fillCircle(p.x - 2.5, p.y + 3, 3).fillCircle(p.x + 2.5, p.y + 3, 3);
        g.fillTriangle(p.x - 5.5, p.y + 4, p.x + 5.5, p.y + 4, p.x, p.y + 11);
      } else {
        g.fillTriangle(p.x - 5, p.y, p.x + 5, p.y, p.x, p.y + 11);
      }
    }
  }

  /** Vật treo trần (dây + hình vẽ ở đầu dây), đung đưa nhẹ. */
  private hanging(p: { x: number; y: number }, draw: (g: Phaser.GameObjects.Graphics, x: number, y: number) => void) {
    const y = Math.max(34, p.y - 150); // không để vật treo bị cắt ở mép trên
    const g = this.add.graphics({ x: p.x, y: 0 }).setDepth(5000);
    g.lineStyle(1.5, 0x7a3e12, 1).lineBetween(0, 0, 0, y);
    draw(g, 0, y);
    this.tweens.add({ targets: g, angle: { from: -1.5, to: 1.5 }, yoyo: true, repeat: -1, duration: 1800, ease: "Sine.InOut" });
  }

  private drawThemeExtras() {
    const theme = this.cfg.theme;

    if (theme === "theme_pastel") {
      this.bunting([0xf48fb1, 0xb39ddb, 0x80cbc4, 0xfff59d], true);
      // Chùm bóng bay ở góc tiệm, nhún nhẹ.
      const c = this.iso(7.6, 6.5);
      [0xf48fb1, 0xb39ddb, 0x80deea].forEach((color, i) => {
        const g = this.add.graphics().setDepth(c.y + 20);
        const bx = c.x + (i - 1) * 11;
        const by = c.y - 58 - (i % 2) * 10;
        g.lineStyle(1, 0x9e9e9e, 1).lineBetween(c.x, c.y - 4, bx, by + 9);
        g.fillStyle(color, 1).fillEllipse(bx, by, 16, 19);
        g.fillStyle(0xffffff, 0.6).fillEllipse(bx - 3, by - 4, 4, 6);
        this.tweens.add({ targets: g, y: -3, yoyo: true, repeat: -1, duration: 1300 + i * 200, ease: "Sine.InOut" });
      });
      // Biển hiệu nhỏ trên tường trái
      const p = this.wallL(4.4, 66);
      const sign = this.add.graphics().setDepth(-897);
      sign.fillStyle(0xffffff, 1).fillRoundedRect(p.x - 18, p.y - 8, 36, 16, 8);
      sign.lineStyle(2, 0xf48fb1, 1).strokeRoundedRect(p.x - 18, p.y - 8, 36, 16, 8);
      this.add
        .text(p.x, p.y, "Pastel", { fontFamily: "Baloo 2, sans-serif", fontSize: "10px", color: "#D81B60", fontStyle: "700" })
        .setOrigin(0.5)
        .setDepth(-896);
      return;
    }

    if (theme === "theme_wood") {
      // Chậu cây treo trần
      for (const spot of [this.iso(4.6, 3.9), this.iso(1.6, 2.2)]) {
        this.hanging(spot, (g, x, y) => {
          g.fillStyle(0xa0561a, 1).fillRect(x - 7, y + 6, 14, 9);
          g.fillStyle(0x4f8a5c, 1).fillCircle(x - 6, y + 17, 5).fillCircle(x + 6, y + 18, 5).fillCircle(x, y + 21, 5);
          g.fillStyle(0x6fa678, 1).fillCircle(x, y + 5, 6);
        });
      }
      // Bảng phấn thực đơn giữa cửa sổ và cửa ra vào
      const a = this.wallR(3.6, 52);
      const b = this.wallR(4.5, 52);
      const pts = [a, b, { x: b.x, y: b.y + 30 }, { x: a.x, y: a.y + 30 }].map((q) => new Phaser.Geom.Point(q.x, q.y));
      const board = this.add.graphics().setDepth(-897);
      board.fillStyle(0x2e4a3a, 1).fillPoints(pts, true);
      board.lineStyle(3, 0x8d6448, 1).strokePoints(pts, true);
      board.lineStyle(1.5, 0xffffff, 0.8);
      // Nét phấn song song cạnh bảng (nội suy dọc cạnh trên, chừa lề 20%).
      const lerp = (t: number, dz: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + dz });
      for (let i = 0; i < 3; i++) {
        const [p0, p1] = [lerp(0.2, 9 + i * 7), lerp(0.8, 9 + i * 7)];
        board.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
      // Thùng gỗ ở góc
      this.box(0.55, 6.4, 0.5, 0.5, 24, 0x8d5a2b);
      this.box(0.55, 6.4, 0.52, 0.52, 2, 0x4e342e, 1, 6);
      this.box(0.55, 6.4, 0.52, 0.52, 2, 0x4e342e, 1, 17);
      return;
    }

    if (theme === "theme_midautumn") {
      this.bunting([0xc62828, 0xffc107]);
      // Đèn ông sao
      this.hanging(this.iso(4.4, 5.2), (g, x, y) => {
        const pts = Array.from({ length: 10 }, (_, i) => {
          const r = i % 2 ? 5 : 12;
          const ang = (Math.PI / 5) * i - Math.PI / 2;
          return new Phaser.Geom.Point(x + r * Math.cos(ang), y + 14 + r * Math.sin(ang));
        });
        g.fillStyle(0xffc107, 1).fillPoints(pts, true);
        g.fillStyle(0xd84315, 1).fillCircle(x, y + 14, 3);
      });
      // Hộp bánh Trung Thu
      this.box(7.4, 6.4, 0.6, 0.6, 12, 0xc62828);
      this.box(7.4, 6.4, 0.6, 0.6, 2, 0xffd54f, 1, 12);
      this.box(7.28, 6.3, 0.2, 0.2, 5, 0xd4a15a, 2, 14);
      this.box(7.52, 6.5, 0.2, 0.2, 5, 0xd4a15a, 2, 14);
      return;
    }

    if (theme === "theme_xmas") {
      // Cây thông 3 tầng, quả châu, ngôi sao, hộp quà
      const c = this.iso(7.2, 5.9);
      this.dropShadow(6.85, 5.55, 0.7, 0.7);
      const tree = this.add.graphics().setDepth(c.y + 10);
      tree.fillStyle(0x6d4c41, 1).fillRect(c.x - 3, c.y - 12, 6, 10);
      for (const [dy, half, hgt] of [[0, 22, 20], [-16, 18, 16], [-30, 13, 12]]) {
        tree.fillStyle(0x2e7d32, 1).fillTriangle(c.x, c.y - 26 + dy - hgt, c.x - half, c.y - 12 + dy, c.x + half, c.y - 12 + dy);
      }
      for (const [dx, dy, col] of [[-10, -18, 0xe53935], [8, -26, 0xffd54f], [-5, -38, 0x42a5f5], [6, -45, 0xe53935], [0, -30, 0xffffff]]) {
        tree.fillStyle(col, 1).fillCircle(c.x + dx, c.y + dy, 2.5);
      }
      const star = this.add.star(c.x, c.y - 72, 5, 3, 7, 0xffd54f).setDepth(c.y + 11);
      this.tweens.add({ targets: star, scale: { from: 0.85, to: 1.15 }, yoyo: true, repeat: -1, duration: 700 });
      for (const [tx, ty, col] of [[6.6, 6.5, 0xe53935], [7.8, 6.4, 0x42a5f5]]) {
        this.box(tx, ty, 0.35, 0.35, 10, col, 12);
        this.box(tx, ty, 0.08, 0.36, 11, 0xffd54f, 13, 0, false);
      }
      // Vòng nguyệt quế trên cửa ra vào
      const d = this.wallR(5.2, 44);
      const wreath = this.add.graphics().setDepth(-896);
      wreath.lineStyle(5, 0x2e7d32, 1).strokeCircle(d.x, d.y, 8);
      wreath.fillStyle(0xe53935, 1);
      wreath.fillTriangle(d.x - 5, d.y + 8, d.x, d.y + 5, d.x - 2, d.y + 13);
      wreath.fillTriangle(d.x + 5, d.y + 8, d.x, d.y + 5, d.x + 2, d.y + 13);
      // Tất Noel treo tường trái
      for (const x of [1.2, 3.2, 5.2]) {
        const p = this.wallL(x, WALL_H - 14);
        const sock = this.add.graphics().setDepth(-896);
        sock.fillStyle(0xffffff, 1).fillRect(p.x - 4, p.y, 8, 4);
        sock.fillStyle(0xc62828, 1).fillRect(p.x - 4, p.y + 4, 8, 10).fillEllipse(p.x + 1, p.y + 15, 12, 6);
      }
      // Tuyết rơi nhẹ khắp tiệm
      const { width, height } = this.scale;
      for (let i = 0; i < 16; i++) {
        const flake = this.add
          .circle(Phaser.Math.Between(0, width), -10, Phaser.Math.FloatBetween(1.5, 3), 0xffffff, 0.9)
          .setDepth(5002);
        this.tweens.add({
          targets: flake,
          y: height + 10,
          x: flake.x + Phaser.Math.Between(-20, 20),
          duration: Phaser.Math.Between(4500, 8000),
          delay: i * 400,
          repeat: -1,
        });
      }
    }
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
