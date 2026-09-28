// Mini-game làm bánh: 3 bước Trộn → Nướng → Trang trí.
// Mỗi bước: kim chạy qua lại trên thanh, người chơi CHẠM khi kim nằm trong vùng vàng.
// Scene chỉ đo điểm canh giờ (0..100) để phản hồi tức thì; số sao do SERVER quyết định.
import * as Phaser from "phaser";
import { scoreTap, type Zone } from "@/lib/game/scoring";

export type BakeSceneConfig = {
  recipeImage: string | null;
  difficulty: number; // 1..8 (theo thứ tự công thức) → kim chạy nhanh hơn
  onStep: (step: number, lastScore: number | null) => void;
  onComplete: (scores: [number, number, number]) => void;
};

const COLORS = {
  bg: 0xf4d9ab,
  oven: 0xc9722e,
  ovenShadow: 0x9c5a1e,
  ovenInner: 0x6b3a16,
  glow: 0xf4a53c,
  bar: 0xebc98e,
  zone: 0xf4c542,
  needle: 0x7a3e12,
  bowl: 0xffffff,
  batter: 0xf7e08a,
  cream: 0xfff6e9,
};

const BAR_W_RATIO = 0.88;
const BAR_H = 26;

export class BakeScene extends Phaser.Scene {
  private cfg!: BakeSceneConfig;
  private step = 0;
  private scores: number[] = [];
  private needle = 0; // 0..1
  private dir = 1;
  private speed = 0.6; // phần thanh / giây
  private zone: Zone = { start: 0.4, width: 0.22 };
  private waiting = false;

  private art!: Phaser.GameObjects.Container;
  private zoneRect!: Phaser.GameObjects.Rectangle;
  private needleRect!: Phaser.GameObjects.Rectangle;
  private feedback!: Phaser.GameObjects.Text;
  private barX = 0;
  private barW = 0;
  private barY = 0;

  constructor() {
    super("bake");
  }

  init(cfg: BakeSceneConfig) {
    this.cfg = cfg;
    this.step = 0;
    this.scores = [];
  }

  preload() {
    if (this.cfg.recipeImage) this.load.image("cake", this.cfg.recipeImage);
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.barW = width * BAR_W_RATIO;
    this.barX = (width - this.barW) / 2;
    this.barY = height - BAR_H - 18;

    this.art = this.add.container(width / 2, (height - BAR_H - 40) / 2 + 6);

    // Thanh canh giờ
    this.add.rectangle(width / 2, this.barY + BAR_H / 2, this.barW, BAR_H, COLORS.bar).setOrigin(0.5);
    this.zoneRect = this.add.rectangle(0, this.barY, 10, BAR_H, COLORS.zone).setOrigin(0, 0);
    this.needleRect = this.add.rectangle(0, this.barY - 6, 6, BAR_H + 12, COLORS.needle).setOrigin(0.5, 0);

    this.feedback = this.add
      .text(width / 2, this.barY - 34, "", {
        fontFamily: "Nunito, sans-serif",
        fontSize: "22px",
        fontStyle: "800",
        color: "#7A3E12",
        stroke: "#FFF6E9",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.input.on("pointerdown", () => this.tap());
    this.startStep();
  }

  /** Gọi từ nút CHẠM! (React) hoặc chạm vào canvas. */
  tap() {
    if (!this.waiting) return;
    this.waiting = false;
    const score = scoreTap(this.needle, this.zone);
    this.scores.push(score);
    this.showFeedback(score);

    this.time.delayedCall(750, () => {
      if (this.scores.length >= 3) {
        this.cfg.onComplete(this.scores as [number, number, number]);
      } else {
        this.step += 1;
        this.cfg.onStep(this.step, score);
        this.startStep();
      }
    });
  }

  private startStep() {
    const d = Math.min(8, Math.max(1, this.cfg.difficulty));
    this.speed = 0.5 + this.step * 0.18 + d * 0.05;
    const width = 0.24 - this.step * 0.035 - d * 0.004;
    this.zone = { start: Phaser.Math.FloatBetween(0.15, 0.85 - width), width };
    this.needle = Phaser.Math.FloatBetween(0, 0.1);
    this.dir = 1;

    this.zoneRect.setPosition(this.barX + this.zone.start * this.barW, this.barY);
    this.zoneRect.setSize(this.zone.width * this.barW, BAR_H);
    this.drawArt();
    this.waiting = true;
  }

  update(_time: number, delta: number) {
    if (this.waiting) {
      this.needle += this.dir * this.speed * (delta / 1000);
      if (this.needle >= 1) {
        this.needle = 1;
        this.dir = -1;
      } else if (this.needle <= 0) {
        this.needle = 0;
        this.dir = 1;
      }
    }
    this.needleRect.x = this.barX + this.needle * this.barW;
  }

  private showFeedback(score: number) {
    const text = score >= 90 ? "Hoàn hảo!" : score >= 70 ? "Tốt lắm!" : score >= 40 ? "Tạm được" : "Hụt rồi!";
    this.feedback.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.feedback, scale: 1, duration: 160, ease: "Back.Out" });
    this.tweens.add({ targets: this.feedback, alpha: 0, delay: 520, duration: 200 });
    this.cameras.main.shake(score >= 70 ? 0 : 120, 0.004);
  }

  // Hình minh họa giữa màn theo từng bước.
  private drawArt() {
    this.art.removeAll(true);
    const size = Math.min(this.scale.width * 0.5, this.barY - 70);

    if (this.step === 0) {
      const bowl = this.add.graphics();
      bowl.fillStyle(COLORS.ovenShadow, 1).fillEllipse(0, size * 0.18, size * 1.05, size * 0.5);
      bowl.fillStyle(COLORS.bowl, 1).fillEllipse(0, size * 0.1, size * 1.05, size * 0.55);
      bowl.fillStyle(COLORS.batter, 1).fillEllipse(0, 0, size * 0.85, size * 0.3);
      // Gốc xoay ở đầu thìa ngập trong bột → thìa khuấy qua lại trong bát.
      const spoon = this.add.rectangle(0, size * 0.02, 10, size * 0.62, 0xd9b98a).setOrigin(0.5, 1);
      this.art.add([bowl, spoon]);
      this.tweens.add({ targets: spoon, angle: { from: -25, to: 25 }, yoyo: true, repeat: -1, duration: 420 });
      return;
    }

    const oven = this.add.graphics();
    oven.fillStyle(COLORS.ovenShadow, 1).fillRoundedRect(-size / 2, -size / 2 + 8, size, size, 28);
    oven.fillStyle(COLORS.oven, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 28);
    oven.fillStyle(COLORS.ovenInner, 1).fillRoundedRect(-size * 0.36, -size * 0.3, size * 0.72, size * 0.62, 16);
    this.art.add(oven);

    if (this.step === 1) {
      const glow = this.add.rectangle(0, size * 0.2, size * 0.6, 8, COLORS.glow).setAlpha(0.8);
      this.art.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 500 });
    }

    const cakeSize = size * 0.5;
    if (this.textures.exists("cake")) {
      const img = this.add.image(0, size * 0.02, "cake");
      img.setScale(cakeSize / Math.max(img.width, img.height));
      this.art.add(img);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(COLORS.cream, 1).fillRoundedRect(-cakeSize / 2, -cakeSize / 3, cakeSize, cakeSize * 0.7, 10);
      this.art.add(ph);
    }

    if (this.step === 2) {
      for (let i = 0; i < 6; i++) {
        const dot = this.add.circle(
          Phaser.Math.Between(-size * 0.25, size * 0.25),
          Phaser.Math.Between(-size * 0.2, size * 0.1),
          4,
          [0xe28b9b, 0x6fa678, 0x7c6bd6][i % 3],
        );
        this.art.add(dot);
        this.tweens.add({ targets: dot, y: dot.y - 6, yoyo: true, repeat: -1, duration: 300 + i * 60 });
      }
    }
  }
}
