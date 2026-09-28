import * as Phaser from "phaser";
import { IsoShopScene, type IsoShopConfig, type SceneCustomer } from "./scenes/IsoShopScene";

/** Tạo cảnh tiệm isometric gắn vào `parent`. Chỉ gọi ở browser (import động từ client component). */
export function createShopGame(parent: HTMLElement, cfg: IsoShopConfig) {
  // Game khởi động bất đồng bộ: giữ danh sách khách mới nhất để scene đọc khi dựng xong.
  const feed = { list: [] as SceneCustomer[] };
  const width = Math.min(parent.clientWidth || 360, 448);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height: Math.round(width * 0.8),
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    render: { antialias: true },
    // Cảnh tiệm chủ yếu đứng yên → 30 khung hình/giây là đủ mượt, đỡ tốn pin/CPU điện thoại.
    fps: { target: 30 },
    banner: false,
    audio: { noAudio: true },
    scene: [],
  });
  game.scene.add("iso-shop", IsoShopScene, true, { ...cfg, feed });
  const scene = () => game.scene.getScene("iso-shop") as IsoShopScene | null;

  return {
    sync: (list: SceneCustomer[]) => {
      feed.list = list;
      scene()?.sync(list);
    },
    setHour: (hour: number) => scene()?.setHour(hour),
    destroy: () => game.destroy(true),
  };
}
