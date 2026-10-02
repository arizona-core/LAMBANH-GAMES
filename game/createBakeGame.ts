import * as Phaser from "phaser";
import { BakeScene, type BakeSceneConfig } from "./scenes/BakeScene";

/** Tạo game Phaser gắn vào `parent`. Chỉ gọi ở browser (import động từ client component). */
export function createBakeGame(parent: HTMLElement, cfg: BakeSceneConfig) {
  const width = Math.min(parent.clientWidth || 360, 448);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height: Math.round(width * 0.8), // khớp khung .canvas (aspect-ratio 1 / 0.8)
    backgroundColor: "#F4D9AB",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    render: { antialias: true },
    banner: false,
    audio: { noAudio: true },
    scene: [],
  });
  game.scene.add("bake", BakeScene, true, cfg);
  const scene = () => game.scene.getScene("bake") as BakeScene | null;

  return {
    /** Nút chính: giữ để khuấy · cho vào lò · lấy bánh ra. */
    press: () => scene()?.press(),
    release: () => scene()?.release(),
    destroy: () => game.destroy(true),
  };
}
