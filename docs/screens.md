# Sweet Shop — Danh sách màn hình (21)

Bản thiết kế UI đầy đủ (canvas dạng Figma) đã dựng sẵn. Mỗi màn = 1 route/scene khi code.
Khung 390×844. Bám `design-system.md`.

## 1 · Onboarding & màn chờ
1. **Loading / Splash** — logo, thanh loading, tagline.
2. **Đăng nhập Google** — 1 nút Google OAuth, điều khoản. (Bỏ "chơi thử khách": trái với "chỉ Google OAuth" và dễ bị lạm dụng tạo acc phụ.)
3. **Tạo chủ quán & quán** — tên chủ quán, tên quán (unique + lọc từ bậy), avatar, màu.
4. **Hướng dẫn đầu game** — coach-mark trỏ vào lò, mascot dẫn dắt.

## 2 · Gameplay chính
5. **Tiệm chính (Home)** — HUD (xu/gem/level), tủ kính, khách chờ, bottom nav 5 mục.
6. **Bếp & công thức** — danh sách công thức, công thức khóa, kho nguyên liệu.
7. **Mini-game làm bánh** — các bước Trộn→Nướng→Trang trí, thanh canh giờ, chất lượng sao.
8. **Chợ người chơi** — tab Mua/Bán/Đơn của tôi, listing, phí 5%.

## 3 · Online, xã hội & doanh thu
9. **Bảng xếp hạng** — podium top 3, danh sách, hạng của bạn, mùa giải.
10. **Ghé thăm quán** — quán người khác, bánh đang bán, viết đánh giá sao + tip.
11. **Nhiệm vụ & điểm danh** — chuỗi điểm danh 7 ngày (đã làm, `/daily`); quest ngày + Sweet Pass: GĐ3.
12. **Cửa hàng** — tab Trang trí/Đồng phục/Gem, mua bằng xu/gem, Sweet Pass. Không bán bằng tiền thật.

## 4 · Vận hành & quản lý tiệm
13. **Cài đặt** — hồ sơ, đổi tên (gem), âm thanh/nhạc/thông báo, ngôn ngữ, đăng xuất.
14. **Giờ mở / đóng cửa** — công tắc mở-đóng, khung giờ, tự mở khi online, thuê nhân viên đêm.
15. **Khách đặt bánh** — đơn khách AI (số lượng, hạn giờ, thưởng xu + uy tín + sao).
16. **Đánh giá & trả lời** — điểm trung bình + phân bố sao, lọc, trả lời từng đánh giá.

## 5 · Doanh thu & sự kiện
17. **Doanh thu** — lọc ngày/tuần/tháng, biểu đồ cột, tách nguồn thu & chi phí.
18. **Sự kiện: Lạm phát** — giá nguyên liệu ↑ toàn server, gợi ý tích trữ/tăng giá.
19. **Sự kiện: Bị công an phạt** — phạt vệ sinh, gợi ý nâng cấp bếp.
20. **Sự kiện: Khách quịt** — mất 1 bánh, gợi ý mua camera an ninh.

## 6 · Đánh giá tự động (AI)
21. **AI khách đánh giá** — khách AI ghé quán, chấm sao + nhận xét theo chất lượng/độ tươi/giá/tốc độ.

> Lưu ý implement: các màn sự kiện (18–21) là **kết quả do server quyết định** rồi hiển
> thị; client chỉ render và cho người chơi chọn hành động tiếp theo (đi chợ, nâng cấp…).
