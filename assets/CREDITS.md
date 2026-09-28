# Nguồn ảnh

Ảnh trong `assets/source/` (và bản tối ưu trong `public/images/`) tải từ **Vecteezy**
(https://www.vecteezy.com) theo giấy phép Vecteezy. Trước khi phát hành công khai:

- Kiểm tra từng ảnh là giấy phép **Free** (bắt buộc ghi nguồn) hay **Pro** (không cần ghi nguồn).
- Với ảnh Free: thêm dòng ghi nguồn trong game (vd màn Cài đặt → "Giới thiệu") dạng
  "Ảnh: <tên tác giả> / Vecteezy".
- `cake-shop-hero.png` là ảnh **tạo bằng AI** (tên gốc có "generative-ai") — kiểm tra điều khoản
  sử dụng thương mại riêng cho loại ảnh này.

| File (đã đổi tên) | Tên gốc (rút gọn) | Dùng cho |
|---|---|---|
| bread.png | crisp-3d-rendered-loaf-of-golden-brown-bread… | Bánh mì |
| cookie.png | delicious-and-freshly-baked-cookies… | Bánh quy socola |
| croissant.webp | 3d-croissant-icon-minimalist-bakery… | Croissant |
| fruit-tart.png | delicious-3d-pie-with-fruit-topping… | Bánh tart trái cây |
| choco-cake.webp | chocolate-cake-3d-illustration-cute-plain-2-tier… | Bánh kem socola |
| berry-choco.png | 3d-valentine-s-day-iconic-cake-in-chocolate… | Bánh kem socola dâu |
| flour.png, egg.png, sugar.png, spoon.png, cornstarch.png | pink-watercolor-baking-supplies-png (1..4) | Nguyên liệu |
| oil.png | stylized-olive-oil-bottle-render… | Dầu ăn |
| strawberry.png | cute-strawberry-used-for-decorating-cakes… | Dâu tây |
| chef-whisk.png | creative-3d-chef-with-whisk… | Mascot "Bếp trưởng Cam" |
| chef-cooking.webp | vibrant-rustic-3d-cartoon-chef-cooking… | (dự phòng) |
| shop-building.png | bakery-shop-icon-3d-render… | Cảnh tiệm, icon PWA |
| cake-shop-hero.png | cake-shop-generative-ai-png | Màn đăng nhập (ảnh AI) |

## Ảnh khách & trang trí (thêm sau)

| Thư mục nguồn | Xuất ra | Dùng cho |
|---|---|---|
| `assets/source/customers/` | `public/images/customers/*.webp` (160×160, cắt vuông) | Ảnh chân dung khách NPC + avatar chủ tiệm |
| `assets/source/decor/` | `public/images/decor/*.webp` (≤256, nền trong suốt) | Đồ trang trí hiện trong cảnh tiệm |

Hiện có 6 ảnh chân dung (Vecteezy): glasses-man, old-dad, curly-man, asian-girl, cap-man,
alien (gán cho khách id 219, 410, 430, 7, 473, 6). Khách chưa có ảnh hiển thị dấu "?".
Thêm ảnh: thả file vào thư mục nguồn → `npm run assets:build` → migration mới cập nhật
`customers.image` / `upgrade_catalog.image`.
