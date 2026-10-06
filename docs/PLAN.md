# Sweet Shop — Kế hoạch phát triển

Tài liệu này là "nguồn chân lý" về sản phẩm. Claude Code đọc file này khi lập kế hoạch
cho một tính năng.

## 1. Ý tưởng

Game mô phỏng kinh doanh tiệm bánh. Vòng lặp cốt lõi:

> Làm bánh (mini-game) → trưng bày & bán → kiếm xu → mua nguyên liệu / nâng cấp / trang trí → mở khóa công thức → leo bảng xếp hạng.

Điểm khác biệt: **nền kinh tế online giữa người chơi thật** — không chỉ bán cho NPC mà
còn mua bán ở chợ, nhận đơn, ghé thăm & đánh giá quán nhau, đua top theo mùa.

## 2. Hai loại tiền & chống lạm phát

- **Xu (₵):** tiền chính, kiếm bằng gameplay.
- **Gem:** tiền cao cấp, **chỉ kiếm trong game** (nhiệm vụ, điểm danh, sự kiện, giải đấu,
  Sweet Pass). Không bán bằng tiền thật.
- **Sinks (hút tiền ra khỏi nền kinh tế)** để chống lạm phát: phí mặt bằng/điện theo ngày,
  phí chợ 5% mỗi giao dịch, chi phí nâng cấp, phí đổi tên, vé sự kiện.
- Chống gian lận: RLS + giới hạn số giao dịch/ngày, chặn tự-giao-dịch giữa tài khoản
  liên quan (chống smurf/bot), log mọi giao dịch.

## 3. Tính năng online (làm theo thứ tự dễ → khó)

- **D1 — Bảng xếp hạng** (dễ): xếp theo doanh thu/sao, có mùa giải. Async.
- **D2 — Chợ người chơi** (linh hồn kinh tế): rao bán / mua nguyên liệu & bánh. Mọi giao
  dịch qua Edge Function + transaction, phí 5%. Async.
- **D3 — Ghé thăm quán + đánh giá**: xem quán người khác, mua bánh họ bày, chấm sao, tip.
- **D4 — Đơn hàng giữa người chơi** (escrow): đặt bánh cho nhau, giữ tiền đến khi giao.
- **D5 — Giải đấu theo mùa**: bảng đấu, phần thưởng.
- **D6 — Guild + chợ phiên realtime** (khó nhất, làm sau cùng): dùng Supabase Realtime.

> Ưu tiên **async** trước để tiết kiệm quota free tier; realtime để cuối.

## 4. Bảng dữ liệu (Postgres)

Tất cả bật RLS. `*` = chỉ Edge Function (service_role) được ghi.
**Đã làm (MVP):** ingredients, recipes, recipe_ingredients, upgrade_catalog, profiles, inventory,
baked_goods, bake_sessions, upgrades, market_listings, transactions_log + view public_profiles,
leaderboard, market_feed — xem `supabase/migrations/`. Phần còn lại dưới đây làm ở GĐ3–4.

- `profiles` — user, tên chủ quán, tên quán (unique), avatar, màu, level, xu*, gem*, uy tín*.
- `recipes` — công thức (nguyên liệu cần, thời gian, level mở khóa).
- `inventory*` — kho nguyên liệu của người chơi (item, số lượng).
- `baked_goods*` — bánh đã làm / đang trưng bày (độ tươi, giá bán).
- `upgrades*` — nâng cấp/trang trí đã mua.
- `market_listings*` — tin rao ở chợ (người bán, item, số lượng, giá).
- `transactions_log*` — nhật ký mọi giao dịch (audit, chống gian lận).
- `reviews` — đánh giá quán (sao, bình luận, trả lời).
- `player_orders*` — đơn khách/người chơi đặt (escrow, hạn giờ, trạng thái).
- `tournaments`, `tournament_entries` — giải đấu theo mùa.
- `leaderboards` — bảng xếp hạng (có thể là view/materialized view).
- `events_log*` — sự kiện xảy ra với người chơi (lạm phát, phạt, khách quịt, AI review).

## 5. Onboarding

Đăng nhập Google → kiểm tra đã có profile chưa → nếu chưa: màn tạo hồ sơ (tên chủ quán,
tên quán unique + lọc từ bậy, avatar, màu chủ đạo) → tutorial ngắn (làm bánh đầu tiên,
tặng xu) → vào tiệm. Cho đổi tên sau (tốn gem).

## 6. Cửa hàng trong game (không thanh toán tiền thật)

**Không có thanh toán bằng tiền thật**: không nạp, không rút, không quy đổi xu/gem ra tiền,
không tích hợp cổng thanh toán (Stripe…).

Cửa hàng bán bằng xu/gem: skin/trang trí tiệm, đồng phục, biển hiệu, vật phẩm gia tốc
(giảm thời gian chờ), vé sự kiện. **Sweet Pass** theo mùa miễn phí, mở khóa bằng điểm
nhiệm vụ. Không bán sức mạnh trực tiếp ảnh hưởng cạnh tranh.

## 7. Sự kiện & cơ chế vận hành (đã có bản thiết kế UI)

- **Giờ mở/đóng cửa:** mở → có khách & doanh thu nhưng tốn phí; bánh để lâu mất độ tươi.
- **Khách đặt bánh (AI):** đơn riêng có hạn giờ, thưởng xu + uy tín + sao.
- **Đánh giá & trả lời:** quản lý đánh giá, trả lời khách.
- **AI khách đánh giá:** khách AI tự ghé & chấm điểm theo chất lượng/độ tươi/giá/tốc độ.
- **Doanh thu:** báo cáo theo ngày/tuần/tháng, tách nguồn thu & chi phí.
- **Sự kiện ngẫu nhiên:** lạm phát (giá nguyên liệu ↑ toàn server), bị phạt vệ sinh,
  khách quịt tiền — đều xử lý ở server, ghi `events_log`.

## 8. Lộ trình theo giai đoạn

- **GĐ0 — Prototype (2–4 tuần):** gameplay local, chưa cần backend. 1 mini-game làm bánh,
  bán cho NPC, kho tạm trong bộ nhớ. Mục tiêu: thấy vui.
- **GĐ1 — MVP single-player + tài khoản:** Supabase Auth (Google), profiles + onboarding,
  5–8 công thức, 1 mini-game hoàn chỉnh, bán NPC, nâng cấp cơ bản, PWA. Lưu server thật.
- **GĐ2 — Online async:** Edge Functions cho kinh tế; **D1 (BXH) + D2 (Chợ) + D3 (ghé thăm/đánh giá)**.
- **GĐ3 — Xã hội & sự kiện:** D4 (đơn hàng escrow), D5 (giải đấu), Sweet Pass, sự kiện
  ngẫu nhiên, nhiệm vụ/điểm danh.
- **GĐ4 — Realtime + Android:** D6 (guild/chợ phiên realtime), tối ưu, đóng gói Android (TWA/Capacitor).

### Thời gian & khách (đã làm)

- **Đồng hồ game chung cả server:** 1 giây thật = 1 phút game (1 giờ game = 1 phút thật,
  1 ngày game = 24 phút thật). Tiệm **mở cả ngày lẫn đêm** — chỉ đóng khi chủ tiệm tự bấm
  "Đóng cửa" hoặc offline; 0:00 → 7:00 là đêm khuya, vắng khách.
- **500 khách NPC** cố định trong bảng `customers`: tên, tính cách, **hay hối** (chờ ít, bỏ đi thì
  −1 uy tín), **hay quịt** (10–30% không trả tiền), **khó khăn** (đòi bánh ≥4–5★, thiếu sao chỉ trả
  nửa giá), món/sốt/topping ưa thích, độ hào phóng (tip).
- Khách **chỉ tới khi người chơi đang mở app** (client gọi `customer-tick` ~15 giây/lần),
  ~45 lượt/ngày game (+1 mỗi 20 uy tín, tối đa 75). Mỗi lúc tối đa 2 khách trong tiệm
  (giờ cao điểm 3), tính cả khách đang chờ bánh.
- **Làm theo đơn** (không có bánh làm sẵn): nhận đơn → chọn nguyên liệu → trộn → chọn cách nấu
  (nướng/chiên/hấp) + canh lửa → nước chấm/sốt → topping → đóng gói (hộp/túi) → giao.
  Chấm điểm: canh giờ ± lò; thiếu nguyên liệu −25, thừa −15, sai cách nấu −40, sai gói −10.
  Tiền = giá bánh theo sao × tủ trưng bày + 2× giá sốt/topping + tip (nếu đúng sốt & topping khách gọi).
- Chợ chỉ mua bán nguyên liệu, sốt, topping.
- **Người chơi & hồ sơ:** online = hoạt động trong 90 giây (heartbeat 30 giây/lần khi mở app).
  Avatar tải lên: Supabase Storage bucket `avatars` (≤ 256px webp thu nhỏ ở máy, ≤ 512 KB), mỗi người
  1 thư mục; đổi avatar thì server xoá ảnh cũ. Tiểu sử quán ≤ 200 ký tự, lọc từ bậy.
- **Đánh giá:** mỗi đơn giao xong khách tự viết đánh giá (sao = chất lượng, khách khó tính −1 nếu
  chưa 5★, sai sốt/topping −1); khách bỏ đi vì chờ lâu để lại 1★. Trả lời đánh giá (≥10 ký tự) +1 uy tín.
- **Trang trí:** bàn ghế (mỗi chỗ ngồi +3 lượt khách/ngày, tối đa 90), đồ treo tường/sàn/trần
  (+uy tín), 4 theme đổi kiểu tiệm. Cảnh tiệm 2.5D isometric vẽ bằng Phaser.

### Vận hành tiệm (đã làm — migration 0018)

- **Hóa đơn** (`shop_bills`) theo ngày thật giờ VN, chốt sổ 0:00, hạn hết ngày hôm sau; quá hạn +20% phí trễ.
  - Tiền nhà: chỉ ngày có bán hàng, 50 + 10 × cấp + 10 × mỗi chỗ ngồi thêm.
  - Điện 2 ₵/kWh theo cách nấu (nướng 2, chiên 1, hấp 1, làm lạnh 2); nước 1 ₵/m³ (1/đơn, hấp 2, dọn dẹp 2 + thiếu/5).
  - Thuế 5% tiền khách trả. Tiền nhà/điện/nước/phạt quá hạn bị **tự trừ** (tối đa số xu đang có, phần còn lại
    trừ dần); **thuế không tự trừ** — thanh tra phát hiện nợ thuế quá hạn thì truy thu + phạt 100%.
- **Vệ sinh** (`profiles.hygiene`): mỗi đơn −2% (chiên −3%), dọn dẹp → 100% (tốn nước).
- **Ngộ độc** (server tung trong `complete_order`): sai cách nấu +30%, điểm nấu < 30 +15%, mỗi nguyên liệu lạ +8%,
  vệ sinh < 50% +8% (< 25% +20%); khách "bụng yếu" (~12%) ×2 và +5% nếu bánh ≤ 2★; tối đa 70%. Làm đúng + bếp
  sạch = 0%. Ngộ độc: không trả tiền, bồi thường bằng giá món, −3 uy tín, đánh giá 1★.
- **Thanh tra** (`inspections`): chỉ khi tiệm mở + chủ online + tiệm ≥ 6 giờ tuổi, tung ở mỗi `customer-tick`.
  Thực phẩm ~1 lần/3,5 giờ chơi (vệ sinh < 40% → ~1/50 phút, mỗi khách ngộ độc gần đây +3%/nhịp); thuế ~1/5 giờ
  (nợ thuế quá hạn → ~1/50 phút). Mỗi loại cách ≥ 40 phút, 2 lần bất kỳ cách ≥ 10 phút, tối đa 4/24 giờ.
  Phạt vệ sinh < 40%: 50 + 15 × cấp (< 20%: gấp đôi); mỗi khách ngộ độc chưa xử lý: 100 + 20 × cấp. Đạt: +2 uy tín
  (thuế +1); phạt: −3 (có ngộ độc −5). Tiền phạt là hóa đơn hạn 24 giờ.
- **Lì xì** (`lucky_envelopes`): 9 mốc/ngày (online 10/30/60 phút, giao 10/30 đơn, bán ở chợ, 5 nhiệm vụ, tự đóng
  hóa đơn, thanh tra đạt), tiến độ server tính từ dữ liệu thật. Mở bao: 30% chỉ lời chúc, còn lại 10–888 ₵
  (3% kèm 2 gem), kỳ vọng ~77 ₵/bao. Thời gian online cộng dồn từ heartbeat/customer-tick (≤ 60 giây/lần).

### Quy tắc kinh tế đã chốt (MVP)

- Tiền khởi đầu 500 ₵ + 10 gem + nguyên liệu cơ bản. Cấp = 1 + ⌊√(XP/30)⌋.
- Số sao theo điểm trung bình 3 bước (+ thưởng lò): ≥90 ★5, ≥75 ★4, ≥55 ★3, ≥35 ★2.
- Giá NPC = base × (60/80/100/125/150%) × (100 + % tủ trưng bày), làm tròn xuống.
- Chợ: mở từ **cấp 3 và tiệm mở ≥ 24h**; phí 5% **làm tròn lên** (người bán trả); giá/lô trong
  50%–200% giá tham chiếu; tối đa 10 tin mở, 30 tin/ngày, 50 lượt mua/ngày; trần 3.000 ₵/ngày
  mua từ cùng 1 người bán và 20.000 ₵/ngày tiền bán ở chợ (chống chuyển xu giữa acc chính/phụ).
- Chỉ doanh thu bán NPC tính vào BXH (chống acc phụ bơm doanh thu qua chợ).
- Đơn hàng: server từ chối giao sớm hơn `min_play_seconds`; tối đa 600 đơn/ngày, từ đơn thứ
  301 trong 24h bánh tối đa 3★ ("đầu bếp mệt"). Điểm canh giờ do
  client gửi nên bot vẫn đạt điểm cao được — các trần trên giới hạn lợi ích; điểm được lưu trong
  `transactions_log.meta.scores` để phát hiện tài khoản bất thường.
- Mọi Edge Function: tối đa 20 request / 10 giây cho mỗi (người chơi, hành động).

### MVP tối thiểu để ra mắt

5–8 công thức · 1 mini-game · bán NPC · nâng cấp cơ bản · onboarding + Google Auth · PWA
· **đúng 2 tính năng online: BXH + Chợ**.

## 9. Rủi ro cần nhớ

- Supabase free tier giới hạn Realtime & Edge Function → thiết kế nghiêng async.
- Nền kinh tế dễ lạm phát → luôn cân sink/source; log để theo dõi.
- Chống bot/smurf ngay từ thiết kế bảng & giới hạn giao dịch.
