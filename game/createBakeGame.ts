import * as Phaser from "phaser";
import { BakeScene, type BakeSceneConfig } from "./scenes/BakeScene";

/** Tạo game Phaser gắn vào `parent`. Chỉ gọi ở browser (import động từ client component). */
export function createBakeGame(parent: HTMLElement, cfg: BakeSceneConfig) {
  const width = Math.min(parent.clientWidth || 360, 448);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height: Math.round(width * 0.95),
    backgroundColor: "#F4D9AB",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    render: { antialias: true },
    banner: false,
    audio: { noAudio: true },
    scene: [],
  });
  game.scene.add("bake", BakeScene, true, cfg);

  return {
    tap: () => (game.scene.getScene("bake") as BakeScene | null)?.tap(),
    destroy: () => game.destroy(true),
  };
}
