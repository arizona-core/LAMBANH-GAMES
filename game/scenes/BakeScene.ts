// Mini-game nấu 1 đơn trên bàn bếp, 3 pha liền mạch:
//   1. Khuấy: kéo thìa vòng tròn trong tô (hoặc giữ nút) — bột mịn dần; nhả tay khi thước "độ sệt" ở vùng vàng.
//   2. Cho vào: kéo khay bột vào lò / chảo / xửng / tủ lạnh (hoặc bấm nút) — không tính điểm.
//   3. Nấu: bánh nở + đổi màu theo độ chín; kéo bánh ra (hoặc bấm nút) khi thước ở vùng vàng.
// Scene chỉ đo 2 điểm 0..100 (khuấy, nấu) bằng scoreTap để phản hồi tức thì; số sao do SERVER quyết định.
import * as Phaser from "phaser";
import { bakedColor, COOK_GAUGE, COOK_PLACE, DONE_TEXT, MIX_GAUGE, cookStage, type CookStage } from "@/lib/game/cooking";
import type { CookMethod } from "@/lib/game/orders";
import { scoreTap, type Zone } from "@/lib/game/scoring";

export type BakePhase = "mix" | "load" | "cook" | "done";

export type BakeSceneConfig = {
  recipeImage: string | null;
  method: CookMethod;
  difficulty: number; // 1..9 (theo cấp mở khoá món) → bột mịn nhanh hơn, bánh chín nhanh hơn, vùng vàng hẹp hơn
  /** Bậc lò đã mua (0 = lò cơ bản … 3 = lò thông minh) — chỉ đổi hình lò. */
  ovenTier?: number;
  /** Màu bột trong tô (theo nguyên liệu đã bỏ vào). */
  batterColor: number;
  onPhase: (phase: BakePhase) => void;
  onScore: (index: number, score: number) => void;
  /** scores = [khuấy, nấu]; cook = lúc lấy bánh ra (để màn kết quả vẽ bánh sống/vừa/cháy). */
  onComplete: (scores: number[], cook: { progress: number; zone: Zone }) => void;
};

const COLORS = {
  wall: 0xf4d9ab,
  tile: 0xecca93,
  counter: 0xcf955a,
  counterTop: 0xe8b77d,
  counterEdge: 0xa86a32,
  panel: 0xfff6e9,
  raw: 0xf1dfb6,
  zone: 0xf4c542,
  over: 0xc0603a,
  needle: 0x7a3e12,
  bowl: 0xffffff,
  bowlShade: 0xeadfcb,
  metal: 0xb8c2c8,
  metalDark: 0x7d878d,
  spoon: 0xd9a35f,
  spoonDark: 0xa86a32,
  plate: 0xffffff,
};
const SHADOW = 0x3a2412;

const OVEN_LOOKS: { body: number; shadow: number; inner: number; screen?: number }[] = [
  { body: 0xc9722e, shadow: 0x9c5a1e, inner: 0x6b3a16 },
  { body: 0xcfd8dc, shadow: 0x90a4ae, inner: 0x37474f },
  { body: 0xb5532e, shadow: 0x7a2f19, inner: 0x2b1a12 },
  { body: 0x2f3b45, shadow: 0x1b252c, inner: 0x111a20, screen: 0x4dd0e1 },
];

/** Thứ tự vẽ: bếp → món → mặt kính/viền trước → hiệu ứng → món đang kéo → chữ. */
const DEPTH = { station: 2, glow: 2.5, food: 3, front: 4, fx: 5, drag: 8, ui: 20 };
const AUTO_STIR = 7.5; // rad/giây khi giữ nút khuấy
const MIN_STIR = 2.5; // khuấy chậm hơn mức này (rad/giây) thì bột không mịn thêm

function shade(color: number, f: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(Math.min(255, c.red * f), Math.min(255, c.green * f), Math.min(255, c.blue * f));
}

function lerpColor(a: number, b: number, t: number): number {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(a),
    Phaser.Display.Color.IntegerToColor(b),
    100,
    Math.round(Phaser.Math.Clamp(t, 0, 1) * 100),
  );
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

const smooth = (t: number) => Phaser.Math.Clamp(t, 0, 1);

export class BakeScene extends Phaser.Scene {
  private cfg!: BakeSceneConfig;
  private phase: BakePhase = "mix";
  private busy = false; // đang chuyển pha (chờ hiệu ứng) → bỏ qua thao tác
  private scores: number[] = [];
  private zone: Zone = { start: 0.4, width: 0.2 };
  private progress = 0;
  private W = 0;
  private H = 0;
  private S = 0;
  private counterY = 0;
  private barX = 0;
  private barW = 0;
  private barY = 0;
  private gauge!: Phaser.GameObjects.Graphics;
  private needle!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private hint!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  /** Đồ vật của pha hiện tại (xoá khi sang pha mới). */
  private objs: { destroy: () => void }[] = [];

  // ---- khuấy
  private bowl = { x: 0, y: 0, rx: 0, ry: 0 };
  private gain = 0;
  private stirAngle = 0;
  private lastAngle = 0;
  private lastMoveAt = 0;
  private omega = 0;
  private stirring = false;
  private holding = false;
  private spoonAt = { x: 0, y: 0 };
  private batter!: Phaser.GameObjects.Ellipse;
  private gloss!: Phaser.GameObjects.Ellipse;
  private lumps: Phaser.GameObjects.Arc[] = [];
  private swirl!: Phaser.GameObjects.Graphics;
  private spoon!: Phaser.GameObjects.Container;

  // ---- cho vào & nấu
  private win = { x: 0, y: 0, w: 0, h: 0 }; // chỗ đặt món trong lò / chảo / xửng / tủ
  private plate = { x: 0, y: 0 };
  private smokeAt = { x: 0, y: 0 };
  private food!: Phaser.GameObjects.Container;
  private foodImg: Phaser.GameObjects.Image | null = null;
  private paleImg: Phaser.GameObjects.Image | null = null;
  private blob!: Phaser.GameObjects.Ellipse;
  private tray?: Phaser.GameObjects.Container;
  private arrow?: Phaser.GameObjects.Graphics;
  private foodSize = 0;
  private baseScale = 1;
  private duration = 4;
  private cooking = false;
  private dragging = false;
  private finished = false;
  private fx?: Phaser.Time.TimerEvent;

  constructor() {
    super("bake");
  }

  init(cfg: BakeSceneConfig) {
    this.cfg = cfg;
    this.scores = [];
    this.objs = [];
    this.lumps = [];
    this.finished = false;
  }

  preload() {
    if (this.cfg.recipeImage) this.load.image("cake", this.cfg.recipeImage);
  }

  create() {
    const { width, height } = this.scale;
    this.W = width;
    this.H = height;
    this.S = Math.min(width * 0.52, height * 0.5);
    this.counterY = Math.round(height * 0.62);
    this.barW = width * 0.84;
    this.barX = (width - this.barW) / 2;
    this.barY = height - 44;
    this.input.dragDistanceThreshold = 8;

    this.drawKitchen();
    this.gauge = this.add.graphics().setDepth(DEPTH.ui);
    this.needle = this.add.graphics().setDepth(DEPTH.ui + 1);
    const labelStyle = { fontFamily: "Nunito, sans-serif", fontSize: "11px", fontStyle: "800", color: "#7A5C47" };
    this.labels = [0, 1, 2].map(() => this.add.text(0, 0, "", labelStyle).setOrigin(0.5, 0).setDepth(DEPTH.ui + 1));
    this.hint = this.add
      .text(width / 2, 8, "", { fontFamily: "Nunito, sans-serif", fontSize: "12px", fontStyle: "800", color: "#7A3E12", backgroundColor: "#FFF6E9CC", padding: { x: 6, y: 2 } })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui);
    this.feedback = this.add
      .text(width / 2, this.barY - 30, "", {
        fontFamily: "Nunito, sans-serif",
        fontSize: "22px",
        fontStyle: "800",
        color: "#7A3E12",
        stroke: "#FFF6E9",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTH.ui + 2);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.startMix();
  }

  // ================================================================ điều khiển từ React (nút / bàn phím)
  /** Nhấn nút: khuấy (giữ) · cho vào lò · lấy bánh ra. */
  press() {
    if (this.busy) return;
    if (this.phase === "mix") this.holding = true;
    else if (this.phase === "load") this.loadIn();
    else if (this.phase === "cook") this.takeOut();
  }

  /** Nhả nút: đang khuấy thì dừng khuấy và chấm độ sệt. */
  release() {
    if (this.phase !== "mix" || !this.holding) return;
    this.holding = false;
    if (!this.stirring) this.endStir();
  }

  // ================================================================ vòng lặp
  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    if (this.phase === "mix" && !this.busy) {
      if (this.holding && !this.stirring) {
        this.stirAngle += AUTO_STIR * dt;
        this.spoonAt = this.onBowl(this.stirAngle, 0.55);
        this.addStir(AUTO_STIR * dt, AUTO_STIR);
      }
      this.renderMix();
      if (this.progress >= 1) this.finishMix();
    } else if (this.phase === "cook" && this.cooking) {
      this.progress = Math.min(1, this.progress + dt / this.duration);
      this.renderCook();
      if (this.progress >= 1) this.takeOut();
    }
    this.drawNeedle();
  }

  // ================================================================ khung cảnh + thước
  private own<T extends { destroy: () => void }>(obj: T): T {
    this.objs.push(obj);
    return obj;
  }

  private clearPhase() {
    this.fx?.remove();
    this.fx = undefined;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.lumps = [];
  }

  private drawKitchen() {
    const { W, H, counterY: top } = this;
    const g = this.add.graphics().setDepth(0);
    // Tường gạch men + mặt bàn gỗ
    g.fillStyle(COLORS.wall, 1).fillRect(0, 0, W, top);
    g.lineStyle(1, COLORS.tile, 0.9);
    for (let y = 22, row = 0; y < top; y += 22, row++) {
      g.lineBetween(0, y, W, y);
      for (let x = (row % 2) * 18; x < W; x += 36) g.lineBetween(x, y - 22, x, y);
    }
    g.fillStyle(SHADOW, 0.08).fillRect(0, top - 10, W, 10);
    g.fillStyle(COLORS.counterTop, 1).fillRect(0, top, W, 8);
    g.fillStyle(COLORS.counter, 1).fillRect(0, top + 8, W, H - top - 8);
    g.lineStyle(2, COLORS.counterEdge, 0.5).lineBetween(0, top + 8, W, top + 8);
    g.lineStyle(1, COLORS.counterEdge, 0.22);
    for (let y = top + 18; y < H; y += 11) g.lineBetween(0, y, W, y + 3);
  }

  private drawGauge(names: readonly [string, string, string]) {
    const g = this.gauge.clear();
    const { barX: x, barW: w, barY: y } = this;
    const h = 14;
    g.fillStyle(COLORS.panel, 0.95).fillRoundedRect(x - 12, y - 12, w + 24, this.H - y + 6, 14);
    g.fillStyle(COLORS.raw, 1).fillRoundedRect(x, y, w, h, 7);
    const z0 = x + this.zone.start * w;
    const z1 = z0 + this.zone.width * w;
    g.fillStyle(COLORS.over, 0.85).fillRoundedRect(z1, y, x + w - z1, h, { tl: 0, bl: 0, tr: 7, br: 7 });
    g.fillStyle(COLORS.zone, 1).fillRect(z0, y, z1 - z0, h);
    const centers = [(x + z0) / 2, (z0 + z1) / 2, (z1 + x + w) / 2];
    this.labels.forEach((t, i) => t.setText(names[i]).setPosition(centers[i], y + h + 2).setColor(i === 1 ? "#7A3E12" : "#7A5C47"));
  }

  private drawNeedle() {
    const x = this.barX + this.progress * this.barW;
    const y = this.barY;
    this.needle.clear().fillStyle(COLORS.needle, 1).fillTriangle(x - 7, y - 10, x + 7, y - 10, x, y).fillRect(x - 1.5, y, 3, 14);
  }

  private difficulty() {
    return Phaser.Math.Clamp(this.cfg.difficulty, 1, 9);
  }

  private showFeedback(score: number, stage: CookStage, step: "mix" | "cook") {
    const m = this.cfg.method;
    const good = score >= 90 ? "Hoàn hảo!" : step === "mix" ? "Bột mịn!" : "Tốt lắm!";
    const text =
      stage === "good"
        ? good
        : step === "mix"
          ? stage === "raw" ? "Còn lợn cợn!" : "Loãng quá!"
          : stage === "raw"
            ? m === "chill" ? "Chưa đông!" : "Hơi sống!"
            : m === "chill" ? "Đông đá rồi!" : m === "steam" ? "Nhão quá!" : "Cháy mất rồi!";
    this.feedback.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.feedback, scale: 1, duration: 160, ease: "Back.Out" });
    this.tweens.add({ targets: this.feedback, alpha: 0, delay: 650, duration: 220 });
    if (score < 70) this.cameras.main.shake(120, 0.004);
  }

  private flashHint(text: string) {
    const prev = this.hint.text;
    this.hint.setText(text).setColor("#B3261E");
    this.time.delayedCall(1200, () => {
      if (this.hint.text === text) this.hint.setText(prev).setColor("#7A3E12");
    });
  }

  // ================================================================ pha 1: khuấy
  private startMix() {
    this.phase = "mix";
    this.cfg.onPhase("mix");
    const d = this.difficulty();
    const width = 0.22 - d * 0.006;
    this.zone = { start: Phaser.Math.FloatBetween(0.38, 0.72 - width), width };
    this.gain = 1 / (Math.PI * 2 * (5.5 - d * 0.25)); // cấp 1: ~5 vòng là quá tay, cấp 9: ~3 vòng
    this.progress = 0;
    this.stirAngle = -Math.PI / 2;
    this.omega = 0;
    this.drawGauge(MIX_GAUGE);
    this.hint.setText("Kéo thìa khuấy vòng tròn · nhả tay khi bột Mịn");

    const { W, S } = this;
    const depth = S * 0.42;
    const b = (this.bowl = { x: W / 2, y: this.counterY + 6 - depth, rx: S * 0.74, ry: S * 0.28 });
    const color = this.cfg.batterColor;

    const body = this.own(this.add.graphics().setDepth(DEPTH.station));
    body.fillStyle(SHADOW, 0.16).fillEllipse(b.x + 8, this.counterY + 8, b.rx * 2.05, 18);
    const half = (ry: number, from = 0, to = Math.PI) =>
      Array.from({ length: 25 }, (_, i) => {
        const t = from + ((to - from) * i) / 24;
        return new Phaser.Geom.Point(b.x + b.rx * Math.cos(t), b.y + ry * Math.sin(t));
      });
    body.fillStyle(COLORS.bowl, 1).fillPoints(half(depth), true);
    body.fillStyle(COLORS.bowlShade, 0.7).fillPoints(half(depth, 0, Math.PI * 0.42), true); // mặt phải tối nhẹ
    body.lineStyle(3, 0xe28b9b, 0.8).strokePoints(half(depth * 0.55, 0.12, Math.PI - 0.12), false); // sọc trang trí
    body.fillStyle(COLORS.bowlShade, 1).fillEllipse(b.x, b.y, b.rx * 2, b.ry * 2); // lòng tô

    this.batter = this.own(this.add.ellipse(b.x, b.y + b.ry * 0.12, b.rx * 1.74, b.ry * 1.56, color).setDepth(DEPTH.food));
    for (let i = 0; i < 10; i++) {
      const p = this.onBowl(Phaser.Math.FloatBetween(0, Math.PI * 2), Phaser.Math.FloatBetween(0.15, 0.72));
      const lump = this.add.circle(p.x, p.y, Phaser.Math.FloatBetween(S * 0.022, S * 0.04), i % 2 ? 0xfffaf0 : shade(color, 0.86));
      this.lumps.push(this.own(lump.setDepth(DEPTH.food)));
    }
    this.swirl = this.own(this.add.graphics().setDepth(DEPTH.food));
    this.gloss = this.own(this.add.ellipse(b.x - b.rx * 0.25, b.y, b.rx * 0.7, b.ry * 0.45, 0xffffff, 1).setAlpha(0).setDepth(DEPTH.food));
    const rim = this.own(this.add.graphics().setDepth(DEPTH.front));
    rim.lineStyle(4, 0xffffff, 1).strokeEllipse(b.x, b.y, b.rx * 2, b.ry * 2);
    rim.lineStyle(2, COLORS.bowlShade, 1).strokePoints(half(b.ry, 0.05, Math.PI - 0.05), false);

    // Thìa gỗ: đầu thìa ở gốc container, cán chĩa lên trên-phải.
    const spoonG = this.add.graphics();
    spoonG.fillStyle(COLORS.spoonDark, 1).fillRoundedRect(-5, -S * 0.56, 10, S * 0.5, 5);
    spoonG.fillStyle(COLORS.spoon, 1).fillRoundedRect(-4, -S * 0.56, 7, S * 0.5, 4);
    spoonG.fillStyle(COLORS.spoon, 1).fillEllipse(0, 0, S * 0.16, S * 0.1);
    spoonG.fillStyle(0xffffff, 0.25).fillEllipse(-S * 0.025, -S * 0.015, S * 0.06, S * 0.03);
    this.spoon = this.own(this.add.container(0, 0, [spoonG]).setDepth(DEPTH.fx).setAngle(22));
    this.spoonAt = this.onBowl(this.stirAngle, 0.55);
    this.renderMix();
  }

  /** Điểm trong lòng tô theo góc + bán kính tương đối (0 = tâm, 1 = mép bột). */
  private onBowl(angle: number, r: number) {
    const b = this.bowl;
    return { x: b.x + Math.cos(angle) * b.rx * 0.86 * r, y: b.y + b.ry * 0.12 + Math.sin(angle) * b.ry * 0.78 * r };
  }

  private angleAt(p: Phaser.Input.Pointer) {
    const b = this.bowl;
    return Math.atan2((p.y - b.y) / b.ry, (p.x - b.x) / b.rx);
  }

  private addStir(da: number, omega: number) {
    const speed = Phaser.Math.Clamp((omega - MIN_STIR) / 3, 0, 1);
    this.progress = Math.min(1, this.progress + Math.abs(da) * this.gain * speed);
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.phase !== "mix" || this.busy) return;
    const b = this.bowl;
    const nx = (p.x - b.x) / (b.rx * 1.25);
    const ny = (p.y - b.y) / (b.ry * 2.4);
    if (nx * nx + ny * ny > 1) return; // chạm ngoài tô
    this.stirring = true;
    this.lastAngle = this.angleAt(p);
    this.lastMoveAt = performance.now();
    this.omega = 0;
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.phase !== "mix" || !this.stirring || this.busy) return;
    const a = this.angleAt(p);
    const da = Phaser.Math.Angle.Wrap(a - this.lastAngle);
    const now = performance.now();
    const dt = Math.max(0.008, (now - this.lastMoveAt) / 1000);
    this.omega = this.omega * 0.7 + (Math.abs(da) / dt) * 0.3;
    this.lastAngle = a;
    this.lastMoveAt = now;
    this.stirAngle = a;
    // Đầu thìa theo ngón tay nhưng không ra khỏi lòng tô.
    const b = this.bowl;
    const r = Math.min(0.8, Math.hypot((p.x - b.x) / (b.rx * 0.86), (p.y - b.y) / (b.ry * 0.78)));
    this.spoonAt = this.onBowl(a, r);
    this.addStir(da, this.omega);
  }

  private onUp() {
    if (this.phase !== "mix" || !this.stirring) return;
    this.stirring = false;
    if (!this.holding) this.endStir();
  }

  private endStir() {
    if (this.busy) return;
    if (this.progress >= 0.1) this.finishMix();
    else this.flashHint("Khuấy vòng tròn nhanh tay hơn nữa!");
  }

  private renderMix() {
    const z0 = this.zone.start;
    const z1 = z0 + this.zone.width;
    const smoothness = smooth(this.progress / z0);
    const runny = smooth((this.progress - z1) / (1 - z1));
    this.lumps.forEach((l) => l.setAlpha(1 - smoothness));
    this.gloss.setAlpha(runny * 0.45);
    this.batter.setScale(1 + runny * 0.04).setFillStyle(lerpColor(this.cfg.batterColor, 0xffffff, runny * 0.25));

    // Vệt xoáy theo thìa
    const g = this.swirl.clear();
    g.lineStyle(2, shade(this.cfg.batterColor, 0.82), 0.55 * (0.3 + smoothness * 0.7));
    for (const [r, off] of [[0.58, 0], [0.32, Math.PI]] as const) {
      const pts = Array.from({ length: 12 }, (_, i) => {
        const p = this.onBowl(this.stirAngle + off - i * 0.16, r);
        return new Phaser.Geom.Point(p.x, p.y);
      });
      g.strokePoints(pts, false);
    }
    this.spoon.setPosition(this.spoonAt.x, this.spoonAt.y).setAngle(22 + Math.sin(this.stirAngle) * 8);
  }

  private finishMix() {
    if (this.phase !== "mix" || this.busy) return;
    this.busy = true;
    this.stirring = false;
    this.holding = false;
    const score = scoreTap(this.progress, this.zone);
    this.scores[0] = score;
    this.cfg.onScore(0, score);
    this.showFeedback(score, cookStage(this.progress, this.zone), "mix");
    this.time.delayedCall(900, () => {
      this.clearPhase();
      this.startLoad();
    });
  }

  // ================================================================ pha 2: cho vào lò
  private startLoad() {
    const m = this.cfg.method;
    this.phase = "load";
    this.busy = false;
    this.cfg.onPhase("load");
    const d = this.difficulty();
    const width = 0.2 - d * 0.006;
    this.zone = { start: Phaser.Math.FloatBetween(0.45, 0.78 - width), width };
    this.duration = 4.6 - d * 0.24; // giây từ sống tới quá tay: cấp 1 ≈ 4.4 giây, cấp 9 ≈ 2.4 giây
    this.progress = 0;
    this.drawGauge(COOK_GAUGE[m]);
    this.hint.setText(`Kéo khay bột vào ${COOK_PLACE[m]}`);
    this.drawStation();

    const { S } = this;
    this.plate = { x: this.W * 0.2, y: this.counterY + 4 };
    const tray = this.add.container(this.plate.x, this.plate.y - S * 0.06).setDepth(DEPTH.drag);
    const g = this.add.graphics();
    g.fillStyle(SHADOW, 0.16).fillEllipse(4, S * 0.08, S * 0.58, 12);
    if (m === "bake") {
      g.fillStyle(COLORS.metalDark, 1).fillRoundedRect(-S * 0.28, -S * 0.02, S * 0.56, S * 0.1, 6);
      g.fillStyle(COLORS.metal, 1).fillRoundedRect(-S * 0.28, -S * 0.05, S * 0.56, S * 0.1, 6);
    } else if (m === "chill") {
      g.fillStyle(0xd6eefb, 0.9).fillRoundedRect(-S * 0.2, -S * 0.16, S * 0.4, S * 0.22, 8);
    } else {
      g.fillStyle(COLORS.plate, 1).fillEllipse(0, 0, S * 0.56, S * 0.16);
      g.lineStyle(2, COLORS.bowlShade, 1).strokeEllipse(0, 0, S * 0.42, S * 0.11);
    }
    const blobColor = m === "chill" ? lerpColor(this.cfg.batterColor, 0xffffff, 0.2) : this.cfg.batterColor;
    const blob = this.add.ellipse(0, m === "chill" ? -S * 0.07 : -S * 0.06, S * 0.36, S * 0.12, blobColor);
    const shine = this.add.ellipse(-S * 0.06, m === "chill" ? -S * 0.09 : -S * 0.08, S * 0.12, S * 0.03, 0xffffff, 0.45);
    tray.add([g, blob, shine]);
    tray.setSize(S * 0.6, S * 0.3).setInteractive({ draggable: true, useHandCursor: true });
    this.own(tray);

    // Mũi tên gợi ý từ khay tới chỗ nấu
    const arrow = this.own(this.add.graphics().setDepth(DEPTH.fx));
    const ax0 = this.plate.x + S * 0.34;
    const ax1 = this.win.x - this.win.w * 0.55;
    const ay = this.plate.y - S * 0.2;
    arrow.lineStyle(4, COLORS.needle, 0.6).lineBetween(ax0, ay, ax1, ay);
    arrow.fillStyle(COLORS.needle, 0.6).fillTriangle(ax1 + 8, ay, ax1 - 4, ay - 7, ax1 - 4, ay + 7);
    this.tweens.add({ targets: arrow, alpha: 0.25, x: 6, yoyo: true, repeat: -1, duration: 600 });
    this.arrow = arrow;

    let dragged = false;
    tray.on("dragstart", () => {
      dragged = true;
    });
    tray.on("drag", (_p: Phaser.Input.Pointer, x: number, y: number) => tray.setPosition(x, y));
    tray.on("dragend", () => {
      const near = Phaser.Math.Distance.Between(tray.x, tray.y, this.win.x, this.win.y) < Math.max(this.win.w, this.S * 0.5) * 0.75;
      if (near) this.loadIn();
      else this.tweens.add({ targets: tray, x: this.plate.x, y: this.plate.y - S * 0.06, duration: 220, ease: "Back.Out" });
      dragged = false;
    });
    tray.on("pointerup", () => {
      if (!dragged) this.loadIn(); // chạm (không kéo) cũng cho vào
    });
    this.tray = tray;
  }

  /** Vẽ lò / chảo / xửng / tủ lạnh; đặt this.win = chỗ đặt món, this.smokeAt = chỗ khói bốc lên. */
  private drawStation() {
    const { W, S, counterY } = this;
    const m = this.cfg.method;
    const g = this.own(this.add.graphics().setDepth(DEPTH.station));
    const front = this.own(this.add.graphics().setDepth(DEPTH.front));

    if (m === "bake") {
      const look = OVEN_LOOKS[Phaser.Math.Clamp(this.cfg.ovenTier ?? 0, 0, 3)];
      const [w, h] = [S * 1.0, S * 0.9];
      const cx = W * 0.64;
      const top = counterY - h + 4;
      g.fillStyle(SHADOW, 0.18).fillEllipse(cx + 8, counterY + 6, w * 1.05, 16);
      g.fillStyle(look.shadow, 1).fillRoundedRect(cx - w / 2, top + 6, w, h, 18);
      g.fillStyle(look.body, 1).fillRoundedRect(cx - w / 2, top, w, h, 18);
      g.fillStyle(shade(look.body, 0.85), 1).fillRoundedRect(cx - w / 2 + 8, top + 8, w - 16, h * 0.16, 8);
      for (const k of [-0.3, -0.18, 0.3]) g.fillStyle(shade(look.body, 0.6), 1).fillCircle(cx + k * w, top + 8 + h * 0.08, h * 0.04);
      if (look.screen) g.fillStyle(look.screen, 1).fillRoundedRect(cx - w * 0.08, top + 8 + h * 0.04, w * 0.24, h * 0.08, 3);
      const [ww, wh] = [w * 0.74, h * 0.52];
      const wy = top + h * 0.6;
      g.fillStyle(look.inner, 1).fillRoundedRect(cx - ww / 2, wy - wh / 2, ww, wh, 12);
      g.lineStyle(2, 0x9e9e9e, 0.6).lineBetween(cx - ww / 2 + 6, wy + wh * 0.3, cx + ww / 2 - 6, wy + wh * 0.3);
      const glow = this.own(this.add.rectangle(cx, wy + wh / 2 - 7, ww * 0.82, 6, 0xf4a53c).setDepth(DEPTH.glow));
      this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 480 });
      front.lineStyle(4, shade(look.body, 0.72), 1).strokeRoundedRect(cx - ww / 2, wy - wh / 2, ww, wh, 12);
      front.fillStyle(0xffffff, 0.12).fillTriangle(cx - ww / 2 + 8, wy - wh / 2 + 6, cx - ww / 2 + ww * 0.36, wy - wh / 2 + 6, cx - ww / 2 + 8, wy + wh / 2 - 16);
      front.fillStyle(shade(look.body, 0.65), 1).fillRoundedRect(cx - ww * 0.3, wy - wh / 2 - 11, ww * 0.6, 6, 3);
      this.win = { x: cx, y: wy + wh * 0.04, w: ww, h: wh };
      this.smokeAt = { x: cx, y: top + 4 };
      return;
    }

    if (m === "fry") {
      const cx = W * 0.6;
      const cy = counterY - S * 0.16;
      g.fillStyle(SHADOW, 0.18).fillEllipse(cx + 6, counterY + 6, S * 1.0, 16);
      // Bếp + lửa nằm DƯỚI chảo, chỉ ló ra ở 2 bên đáy chảo.
      const stove = this.own(this.add.graphics().setDepth(DEPTH.station - 0.5));
      stove.fillStyle(0x3a3a3a, 1).fillEllipse(cx, counterY - 2, S * 0.86, S * 0.2);
      const flames = this.own(this.add.graphics().setDepth(DEPTH.station - 0.4));
      const fy = cy + S * 0.2;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const x = cx + side * (S * 0.36 + i * S * 0.06);
          const tip = fy - S * (0.16 - i * 0.03);
          flames.fillStyle(i % 2 ? 0xffb74d : 0xff7a1a, 1).fillTriangle(x - 6, fy, x + 6, fy, x + side * 3, tip);
        }
      }
      this.tweens.add({ targets: flames, alpha: 0.55, yoyo: true, repeat: -1, duration: 160 });
      g.fillStyle(0x2f2f2f, 1).fillRoundedRect(cx + S * 0.44, cy - 6, S * 0.3, 11, 5);
      g.fillStyle(0x333333, 1).fillEllipse(cx, cy + 7, S * 0.98, S * 0.42);
      g.fillStyle(0x4a4a4a, 1).fillEllipse(cx, cy, S * 0.98, S * 0.38);
      g.fillStyle(0xf2c14e, 1).fillEllipse(cx, cy, S * 0.84, S * 0.3);
      g.fillStyle(0xffe08a, 0.6).fillEllipse(cx - S * 0.18, cy - S * 0.05, S * 0.24, S * 0.06);
      this.win = { x: cx, y: cy - S * 0.04, w: S * 0.78, h: S * 0.3 };
      this.smokeAt = { x: cx, y: cy - S * 0.1 };
      return;
    }

    if (m === "steam") {
      const cx = W * 0.62;
      const base = counterY + 4;
      g.fillStyle(SHADOW, 0.18).fillEllipse(cx + 6, base + 2, S * 1.05, 16);
      g.fillStyle(0x9aa5ab, 1).fillRoundedRect(cx - S * 0.45, base - S * 0.3, S * 0.9, S * 0.3, 10);
      g.fillStyle(0xc99a4f, 1).fillRoundedRect(cx - S * 0.5, base - S * 0.6, S * 1.0, S * 0.32, 12);
      g.lineStyle(3, 0xa77a35, 1).lineBetween(cx - S * 0.5, base - S * 0.46, cx + S * 0.5, base - S * 0.46);
      g.fillStyle(0xe8cf98, 1).fillEllipse(cx, base - S * 0.6, S * 1.0, S * 0.28);
      g.fillStyle(0xf3e5c2, 1).fillEllipse(cx, base - S * 0.59, S * 0.86, S * 0.2);
      const rimPts = Array.from({ length: 21 }, (_, i) => {
        const t = (Math.PI * i) / 20;
        return new Phaser.Geom.Point(cx + S * 0.5 * Math.cos(t), base - S * 0.6 + S * 0.14 * Math.sin(t));
      });
      front.lineStyle(5, 0xa77a35, 1).strokePoints(rimPts, false);
      this.win = { x: cx, y: base - S * 0.68, w: S * 0.78, h: S * 0.34 };
      this.smokeAt = { x: cx, y: base - S * 0.7 };
      return;
    }

    // chill: tủ lạnh cửa kính
    const [w, h] = [S * 0.82, S * 1.05];
    const cx = W * 0.64;
    const top = counterY - h + 4;
    g.fillStyle(SHADOW, 0.18).fillEllipse(cx + 8, counterY + 6, w * 1.1, 16);
    g.fillStyle(0x9dbccc, 1).fillRoundedRect(cx - w / 2, top + 6, w, h, 16);
    g.fillStyle(0xdfeef5, 1).fillRoundedRect(cx - w / 2, top, w, h, 16);
    g.fillStyle(0xf5fbfd, 1).fillRoundedRect(cx - w * 0.38, top + h * 0.1, w * 0.76, h * 0.8, 10);
    g.fillStyle(0xfffde7, 0.8).fillRect(cx - w * 0.3, top + h * 0.12, w * 0.6, 4);
    g.lineStyle(3, 0xb9d3df, 1).lineBetween(cx - w * 0.36, top + h * 0.42, cx + w * 0.36, top + h * 0.42);
    g.lineBetween(cx - w * 0.36, top + h * 0.75, cx + w * 0.36, top + h * 0.75);
    front.fillStyle(0xd6eefb, 0.2).fillRoundedRect(cx - w * 0.38, top + h * 0.1, w * 0.76, h * 0.8, 10);
    front.lineStyle(4, 0x9dbccc, 1).strokeRoundedRect(cx - w * 0.38, top + h * 0.1, w * 0.76, h * 0.8, 10);
    front.fillStyle(0x7fa3b5, 1).fillRoundedRect(cx + w * 0.3, top + h * 0.35, 6, h * 0.3, 3);
    this.win = { x: cx, y: top + h * 0.6, w: w * 0.7, h: h * 0.34 };
    this.smokeAt = { x: cx, y: top + h * 0.2 };
  }

  private loadIn() {
    if (this.phase !== "load" || this.busy || !this.tray) return;
    this.busy = true;
    this.tray.disableInteractive();
    this.arrow?.destroy();
    this.tweens.add({
      targets: this.tray,
      x: this.win.x,
      y: this.win.y + this.win.h * 0.2,
      scale: 0.8,
      duration: 320,
      ease: "Quad.InOut",
      onComplete: () => {
        this.tray?.destroy();
        this.tray = undefined;
        this.startCook();
      },
    });
  }

  // ================================================================ pha 3: nấu + lấy ra đúng lúc
  private startCook() {
    const m = this.cfg.method;
    this.phase = "cook";
    this.busy = false;
    this.cooking = true;
    this.cfg.onPhase("cook");
    this.hint.setText(`Kéo bánh ra khi ${COOK_GAUGE[m][1]}`);

    const { S } = this;
    const plate = this.own(this.add.graphics().setDepth(DEPTH.station));
    plate.fillStyle(SHADOW, 0.14).fillEllipse(this.plate.x + 4, this.plate.y + 6, S * 0.62, 14);
    plate.fillStyle(COLORS.plate, 1).fillEllipse(this.plate.x, this.plate.y, S * 0.6, S * 0.17);
    plate.lineStyle(2, COLORS.bowlShade, 1).strokeEllipse(this.plate.x, this.plate.y, S * 0.44, S * 0.11);

    this.foodSize = Math.min(this.win.w * 0.72, this.win.h * 1.15);
    const size = this.foodSize;
    this.food = this.own(this.add.container(this.win.x, this.win.y).setDepth(DEPTH.food));
    const blobColor = m === "chill" ? lerpColor(this.cfg.batterColor, 0xffffff, 0.2) : this.cfg.batterColor;
    this.blob = this.add.ellipse(0, size * 0.18, size * 0.82, size * 0.3, blobColor);
    this.food.add(this.blob);
    if (!this.textures.exists("cake")) this.makeGenericCake();
    const src = this.textures.get("cake").getSourceImage();
    this.baseScale = size / Math.max(src.width, src.height);
    this.foodImg = this.add.image(0, 0, "cake").setScale(this.baseScale).setAlpha(0);
    // Lớp phủ màu bột sống (WebGL); canvas renderer không tô được nên chỉ thấy bánh nở dần.
    this.paleImg = this.add.image(0, 0, "cake").setScale(this.baseScale).setTintFill(0xfff1d6).setAlpha(0);
    this.food.add([this.foodImg, this.paleImg]);

    // Chạm / kéo món trong lò để lấy ra.
    const grab = this.own(this.add.zone(this.win.x, this.win.y, this.win.w, this.win.h + 10).setDepth(DEPTH.drag));
    grab.setInteractive({ draggable: true, useHandCursor: true });
    grab.on("dragstart", () => {
      this.dragging = true;
      this.takeOut();
      this.food.setDepth(DEPTH.drag);
    });
    grab.on("drag", (p: Phaser.Input.Pointer) => this.food.setPosition(p.x, p.y));
    grab.on("dragend", () => {
      this.dragging = false;
      this.moveToPlate();
    });
    grab.on("pointerup", () => {
      if (!this.dragging) this.takeOut();
    });

    this.fx = this.time.addEvent({ delay: 110, loop: true, callback: () => this.spawnFx() });
    this.renderCook();
  }

  /** Món chưa có ảnh: vẽ 1 chiếc bánh chung (ruột theo màu bột, phủ kem, quả anh đào) thành texture "cake". */
  private makeGenericCake() {
    const sponge = bakedColor(this.cfg.batterColor);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(shade(sponge, 0.78), 1).fillRoundedRect(14, 54, 100, 56, 14);
    g.fillStyle(sponge, 1).fillRoundedRect(14, 46, 100, 56, 14);
    g.fillStyle(0xfff6e9, 1).fillRoundedRect(10, 34, 108, 24, 12);
    for (const x of [30, 52, 76, 98]) g.fillCircle(x, 58, 7);
    g.fillStyle(0xd32f2f, 1).fillCircle(64, 30, 8);
    g.fillStyle(0xffffff, 0.6).fillCircle(61, 27, 2.5);
    g.generateTexture("cake", 128, 128);
    g.destroy();
  }

  private renderCook() {
    const m = this.cfg.method;
    const z0 = this.zone.start;
    const z1 = z0 + this.zone.width;
    const cooked = smooth(this.progress / z0); // 0 = bột sống → 1 = vừa chín
    const over = smooth((this.progress - z1) / (1 - z1)); // 0 → 1 = quá tay hẳn
    this.blob.setAlpha(1 - cooked);
    if (this.foodImg) {
      // Bánh hiện dần (từ bột sống) và nở lên; lớp màu bột nhạt tan dần khi chín tới.
      const rise = m === "chill" ? 0.96 + 0.04 * cooked : 0.8 + 0.2 * cooked;
      const shown = Math.min(1, cooked * 1.3);
      this.foodImg.setAlpha(shown).setScale(this.baseScale * rise);
      this.paleImg?.setScale(this.baseScale * rise).setAlpha(shown * (1 - cooked) * 0.9);
      const target = m === "chill" ? 0xbfe6ff : m === "steam" ? 0xd0d0d0 : 0x4a2c18;
      const amount = m === "chill" ? 0.7 : m === "steam" ? 0.5 : 0.85;
      this.foodImg.setTint(lerpColor(0xffffff, target, over * amount));
    }
  }

  /** Khói, bọt dầu, hơi nước, tuyết — dày dần theo độ chín. */
  private spawnFx() {
    if (!this.cooking) return;
    const m = this.cfg.method;
    const z1 = this.zone.start + this.zone.width;
    const over = smooth((this.progress - z1) / (1 - z1));
    const { win, S } = this;
    const puff = (x: number, y: number, r: number, color: number, alpha: number, dy: number, ms: number) => {
      const c = this.add.circle(x, y, r, color, alpha).setDepth(DEPTH.fx);
      this.tweens.add({ targets: c, y: y + dy, scale: 1.8, alpha: 0, duration: ms, onComplete: () => c.destroy() });
    };
    const rx = () => win.x + Phaser.Math.FloatBetween(-win.w * 0.35, win.w * 0.35);

    if (m === "fry" && Math.random() < 0.35 + this.progress * 0.6) {
      puff(rx(), win.y + Phaser.Math.FloatBetween(-S * 0.04, S * 0.08), 3, 0xfff1b8, 0.9, -4, 420);
    }
    if (m === "steam" && Math.random() < 0.3 + this.progress * 0.6) {
      puff(rx(), this.smokeAt.y, 9 + over * 6, 0xffffff, 0.7, -S * 0.35, 900);
    }
    if (m === "chill" && Math.random() < 0.25 + this.progress * 0.5) {
      puff(rx(), win.y - win.h * 0.5, 2.5, 0xffffff, 0.95, win.h * 0.7, 1000);
    }
    if ((m === "bake" || m === "fry") && over > 0.05 && Math.random() < over) {
      puff(this.smokeAt.x + Phaser.Math.FloatBetween(-S * 0.2, S * 0.2), this.smokeAt.y, 8, 0x6d6d6d, 0.45, -S * 0.3, 1000);
    }
  }

  private takeOut() {
    if (this.phase !== "cook" || !this.cooking) return;
    this.cooking = false;
    this.fx?.remove();
    this.fx = undefined;
    const score = scoreTap(this.progress, this.zone);
    this.scores[1] = score;
    this.cfg.onScore(1, score);
    this.showFeedback(score, cookStage(this.progress, this.zone), "cook");
    this.phase = "done";
    this.cfg.onPhase("done");
    this.hint.setText(DONE_TEXT[this.cfg.method]);
    this.food.setDepth(DEPTH.drag);
    if (!this.dragging) this.moveToPlate();
  }

  private moveToPlate() {
    this.tweens.add({
      targets: this.food,
      x: this.plate.x,
      y: this.plate.y - this.foodSize * 0.32,
      duration: 380,
      ease: "Quad.Out",
      onComplete: () => this.time.delayedCall(700, () => this.complete()),
    });
  }

  private complete() {
    if (this.finished) return;
    this.finished = true;
    this.cfg.onComplete([this.scores[0] ?? 0, this.scores[1] ?? 0], { progress: this.progress, zone: this.zone });
  }
}
