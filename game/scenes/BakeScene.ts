// Mini-game canh giờ cho 1 đơn: bước "Trộn" rồi "Nấu" (nướng / chiên / hấp / làm lạnh).
// Mỗi bước: kim chạy qua lại trên thanh, người chơi CHẠM khi kim nằm trong vùng vàng.
// Scene chỉ đo điểm canh giờ (0..100) để phản hồi tức thì; số sao do SERVER quyết định.
import * as Phaser from "phaser";
import { scoreTap, type Zone } from "@/lib/game/scoring";
import type { CookMethod } from "@/lib/game/orders";

export type BakeStep = "mix" | "cook";

export type BakeSceneConfig = {
  recipeImage: string | null;
  method: CookMethod;
  difficulty: number; // 1..9 (theo cấp mở khoá món) → kim chạy nhanh hơn
  steps: BakeStep[];
  onStep: (step: number, lastScore: number | null) => void;
  onComplete: (scores: number[]) => void;
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
  pan: 0x4a4a4a,
  oil: 0xf2c14e,
  bamboo: 0xd9b36b,
  steam: 0xffffff,
  fridge: 0xdfeef5,
  fridgeShadow: 0x9dbccc,
  fridgeInner: 0xf5fbfd,
  frost: 0xffffff,
};

const BAR_H = 26;

export class BakeScene extends Phaser.Scene {
  private cfg!: BakeSceneConfig;
  private step = 0;
  private scores: number[] = [];
  private needle = 0;
  private dir = 1;
  private speed = 0.6;
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

    this.barW = width * 0.88;
    this.barX = (width - this.barW) / 2;
    this.barY = height - BAR_H - 18;

    this.art = this.add.container(width / 2, (height - BAR_H - 40) / 2 + 6);

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
      if (this.scores.length >= this.cfg.steps.length) {
        this.cfg.onComplete([...this.scores]);
      } else {
        this.step += 1;
        this.cfg.onStep(this.step, score);
        this.startStep();
      }
    });
  }

  private startStep() {
    const d = Math.min(9, Math.max(1, this.cfg.difficulty));
    this.speed = 0.5 + this.step * 0.2 + d * 0.05;
    const width = 0.24 - this.step * 0.04 - d * 0.004;
    this.zone = { start: Phaser.Math.FloatBetween(0.15, 0.85 - width), width };
    this.needle = Phaser.Math.FloatBetween(0, 0.1);
    this.dir = 1;

    this.zoneRect.setPosition(this.barX + this.zone.start * this.barW, this.barY);
    this.zoneRect.setSize(this.zone.width * this.barW, BAR_H);
    this.drawArt(this.cfg.steps[this.step]);
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
    if (score < 70) this.cameras.main.shake(120, 0.004);
  }

  private addCake(size: number, y = 0) {
    if (this.textures.exists("cake")) {
      const img = this.add.image(0, y, "cake");
      img.setScale(size / Math.max(img.width, img.height));
      this.art.add(img);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(COLORS.cream, 1).fillRoundedRect(-size / 2, y - size / 3, size, size * 0.7, 10);
      this.art.add(ph);
    }
  }

  private drawArt(step: BakeStep) {
    this.art.removeAll(true);
    const size = Math.min(this.scale.width * 0.5, this.barY - 70);

    if (step === "mix") {
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

    if (this.cfg.method === "bake") {
      const oven = this.add.graphics();
      oven.fillStyle(COLORS.ovenShadow, 1).fillRoundedRect(-size / 2, -size / 2 + 8, size, size, 28);
      oven.fillStyle(COLORS.oven, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 28);
      oven.fillStyle(COLORS.ovenInner, 1).fillRoundedRect(-size * 0.36, -size * 0.3, size * 0.72, size * 0.62, 16);
      const glow = this.add.rectangle(0, size * 0.22, size * 0.6, 8, COLORS.glow).setAlpha(0.8);
      this.art.add([oven, glow]);
      this.addCake(size * 0.46, size * 0.02);
      this.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 500 });
      return;
    }

    if (this.cfg.method === "fry") {
      const pan = this.add.graphics();
      pan.fillStyle(COLORS.pan, 1).fillRect(size * 0.45, -8, size * 0.45, 14);
      pan.fillStyle(COLORS.pan, 1).fillEllipse(0, 0, size * 1.05, size * 0.5);
      pan.fillStyle(COLORS.oil, 1).fillEllipse(0, -4, size * 0.88, size * 0.36);
      this.art.add(pan);
      this.addCake(size * 0.4, -10);
      for (let i = 0; i < 7; i++) {
        const b = this.add.circle(Phaser.Math.Between(-size * 0.35, size * 0.35), Phaser.Math.Between(-12, 8), 3, 0xfff1b8);
        this.art.add(b);
        this.tweens.add({ targets: b, alpha: 0, scale: 1.8, repeat: -1, duration: 400 + i * 70, delay: i * 60 });
      }
      return;
    }

    if (this.cfg.method === "chill") {
      const fridge = this.add.graphics();
      fridge.fillStyle(COLORS.fridgeShadow, 1).fillRoundedRect(-size * 0.4, -size / 2 + 8, size * 0.8, size, 22);
      fridge.fillStyle(COLORS.fridge, 1).fillRoundedRect(-size * 0.4, -size / 2, size * 0.8, size, 22);
      fridge.fillStyle(COLORS.fridgeInner, 1).fillRoundedRect(-size * 0.3, -size * 0.36, size * 0.6, size * 0.72, 12);
      fridge.lineStyle(3, COLORS.fridgeShadow, 1).lineBetween(-size * 0.3, size * 0.14, size * 0.3, size * 0.14);
      this.art.add(fridge);
      this.addCake(size * 0.42, -size * 0.08);
      for (let i = 0; i < 5; i++) {
        const flake = this.add.circle(-size * 0.24 + i * size * 0.12, -size * 0.3, 4, COLORS.frost).setAlpha(0.9);
        this.art.add(flake);
        this.tweens.add({ targets: flake, y: flake.y + size * 0.4, alpha: 0, repeat: -1, duration: 1100, delay: i * 180 });
      }
      return;
    }

    // steam
    const basket = this.add.graphics();
    basket.fillStyle(COLORS.ovenShadow, 1).fillRoundedRect(-size / 2, -size * 0.1 + 8, size, size * 0.45, 18);
    basket.fillStyle(COLORS.bamboo, 1).fillRoundedRect(-size / 2, -size * 0.1, size, size * 0.45, 18);
    basket.lineStyle(3, 0xb88f45, 1).lineBetween(-size / 2, size * 0.1, size / 2, size * 0.1);
    this.art.add(basket);
    this.addCake(size * 0.4, -size * 0.2);
    for (let i = 0; i < 4; i++) {
      const puff = this.add.circle(-size * 0.3 + i * size * 0.2, -size * 0.35, 10, COLORS.steam).setAlpha(0.7);
      this.art.add(puff);
      this.tweens.add({ targets: puff, y: puff.y - 30, alpha: 0, repeat: -1, duration: 900, delay: i * 200 });
    }
  }
}
