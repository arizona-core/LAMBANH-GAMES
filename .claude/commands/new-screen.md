---
description: Dựng một màn hình game mới theo bản thiết kế UI và design system
argument-hint: [tên-màn] (vd: kitchen, market, leaderboard)
---

Dựng màn hình **$ARGUMENTS** cho Sweet Shop.

Trước khi code:
1. Đọc `docs/screens.md` để lấy đúng đặc tả nội dung của màn này (thành phần, hành động).
2. Đọc `docs/design-system.md` và tuân thủ token màu/font/bo góc/bóng nút.

Yêu cầu:
- Tạo route trong `app/(game)/` (hoặc `app/(auth)/` nếu là onboarding) bằng App Router.
- Tách phần tĩnh thành React component trong `components/`; nếu là gameplay tương tác cao
  (mini-game làm bánh) thì dựng Phaser scene trong `game/scenes/` và nhúng qua 1 wrapper.
- Dùng component thật: `<button>`, `<a>`, `<input>`+`<label>`; icon là inline SVG (không emoji).
- Responsive theo khung điện thoại, an toàn với safe-area (notch).
- **Không** gọi ghi dữ liệu kinh tế trực tiếp: nếu màn cần thay đổi xu/kho/chợ, gọi hàm
  trong `lib/api/` (bọc Edge Function), đừng tự tính ở client.
- Nối điều hướng tới các màn liên quan.

Cuối cùng: liệt kê file đã tạo và nêu ngắn gọn phần nào còn là placeholder (vd ảnh Vecteezy,
API chưa có) để tôi bổ sung.
