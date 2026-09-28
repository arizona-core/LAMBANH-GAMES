// Tối ưu ảnh gốc (assets/source) thành ảnh web (public/images) + icon PWA.
// Chạy: npm run assets:build. Ảnh đầu ra được commit để deploy không cần chạy lại.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "assets/source";
const CREAM = "#FBEFDD";

// [file nguồn, file đích (trong public/images), kích thước cạnh dài]
const IMAGES = [
  ["bread.png", "items/bread.webp", 256],
  ["cookie.png", "items/cookie.webp", 256],
  ["croissant.webp", "items/croissant.webp", 256],
  ["fruit-tart.png", "items/fruit-tart.webp", 256],
  ["choco-cake.webp", "items/choco-cake.webp", 256],
  ["berry-choco.png", "items/berry-choco.webp", 256],
  ["flour.png", "items/flour.webp", 192],
  ["egg.png", "items/egg.webp", 192],
  ["sugar.png", "items/sugar.webp", 192],
  ["oil.png", "items/oil.webp", 192],
  ["strawberry.png", "items/strawberry.webp", 192],
  ["chef-whisk.png", "mascot-chef.webp", 384],
  ["chef-cooking.webp", "chef-cooking.webp", 384],
  ["cake-shop-hero.png", "cake-shop-hero.webp", 480],
  ["shop-building.png", "shop-building.webp", 384],
];

// Icon PWA dựng từ ảnh tiệm bánh trên nền kem. "maskable" chừa lề an toàn 20%.
const ICONS = [
  ["public/icons/icon-192.png", 192, 0.12],
  ["public/icons/icon-512.png", 512, 0.12],
  ["public/icons/maskable-512.png", 512, 0.22],
  ["app/apple-icon.png", 180, 0.12],
];

async function main() {
  for (const [src, out, size] of IMAGES) {
    const dest = path.join("public/images", out);
    await mkdir(path.dirname(dest), { recursive: true });
    const info = await sharp(path.join(SRC, src))
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(dest);
    console.log(`${dest}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)}KB`);
  }

  await mkdir("public/icons", { recursive: true });
  for (const [dest, size, pad] of ICONS) {
    const inner = Math.round(size * (1 - pad * 2));
    const art = await sharp(path.join(SRC, "shop-building.png"))
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
      .composite([{ input: art, gravity: "center" }])
      .png()
      .toFile(dest);
    console.log(dest);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
