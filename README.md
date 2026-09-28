# Sweet Shop

Game web (PWA, mobile-first) mô phỏng làm bánh và kinh doanh tiệm bánh, có nền kinh tế
giữa người chơi thật. Không có thanh toán bằng tiền thật: xu và gem chỉ kiếm được trong game.

- Sản phẩm, lộ trình và quy tắc kinh tế: [docs/PLAN.md](docs/PLAN.md)
- 21 màn hình và mockup: [docs/screens.md](docs/screens.md), [docs/project/](docs/project/)
- Design token: [docs/design-system.md](docs/design-system.md)
- Quy ước cho Claude Code: [CLAUDE.md](CLAUDE.md)

## Đã làm được (MVP)

| Màn | Route | Việc làm được |
|---|---|---|
| Đăng nhập | `/login` | Google OAuth. Ở local có thêm form "đăng nhập dev". |
| Mở tiệm | `/onboarding` | Nhập tên chủ quán và tên quán (không được trùng, có lọc từ bậy), chọn avatar và màu. |
| Tiệm | `/shop` | HUD, tủ kính, bán bánh cho khách NPC, doanh thu hôm nay, lời nhắc điểm danh, hướng dẫn cho người mới. |
| Bếp | `/kitchen` | 8 công thức mở khóa theo cấp, kho nguyên liệu, mua nguyên liệu. |
| Làm bánh | `/bake/[recipe]` | Mini-game Phaser 3 bước: Trộn → Nướng → Trang trí. |
| Chợ | `/market` | Mua, rao bán, hủy tin rao. Phí 5%, mở từ cấp 3 và sau 24 giờ mở tiệm. |
| Bảng xếp hạng | `/leaderboard` | Xếp theo doanh thu hoặc số sao, podium top 3, hạng của bạn. |
| Cửa hàng | `/store` | Nâng cấp lò (tăng chất lượng), tủ trưng bày (tăng giá bán), đồ trang trí (tăng uy tín). |
| Điểm danh | `/daily` | Chuỗi 7 ngày, thưởng xu và gem. |
| Cài đặt | `/settings` | Đổi tên quán (20 gem), tùy chọn âm thanh, đăng xuất. |

Nguyên tắc bảo mật "client hiển thị, server quyết định":
- **Client:** chỉ đọc dữ liệu qua RLS. Mọi thay đổi đi qua Edge Function.
- **Edge Function:** xác thực JWT, kiểm tra input bằng zod, rồi gọi hàm Postgres.
- **Hàm Postgres:** chạy trong transaction, khóa dòng khi ghi, ghi nhật ký giao dịch và giới hạn tần suất.

## Yêu cầu

- Node.js ≥ 22
- Docker Desktop, để chạy Supabase ở máy

## Chạy ở local

```bash
npm install
npx supabase start          # lần đầu phải tải image Docker, mất vài phút
npx supabase functions serve    # để chạy trong một terminal riêng
```

Tạo file `.env.local` ở thư mục gốc. Lấy giá trị bằng `npx supabase status`: dùng `API_URL` và `PUBLISHABLE_KEY`.

```ini
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

```bash
npm run dev                 # http://localhost:3000
```

Chưa cấu hình Google thì dùng khung **"Đăng nhập dev"** ở màn đăng nhập. Khung này chỉ hiện khi chạy
`npm run dev`, và tài khoản sẽ tự được tạo ở lần đăng nhập đầu tiên.

### Google OAuth ở local (tùy chọn)

1. Vào Google Cloud Console → Credentials → OAuth client (Web).
   Thêm redirect URI `http://127.0.0.1:54321/auth/v1/callback`.
2. Tạo file `supabase/.env` (đã gitignore) với nội dung:
   ```ini
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
   ```
3. Chạy `npx supabase stop && npx supabase start`.

## Kiểm tra

```bash
npm run lint && npm run typecheck && npm run test   # ESLint, TypeScript, Vitest
npm run test:db                                      # pgTAP: kinh tế + RLS (45 test)
node scripts/smoke-functions.mjs                     # gọi thật 11 Edge Function
npm run build
```

## Deploy

1. **Supabase (cloud):**
   - Chạy `npx supabase link --project-ref <ref>`, sau đó `npx supabase db push` và `npx supabase functions deploy`.
   - Đặt secret `ALLOWED_ORIGINS=https://<domain>` bằng `npx supabase secrets set`.
   - Trong Dashboard → Authentication → Providers: bật Google, **tắt Email** (production chỉ dùng Google).
     Nếu vẫn bật Email, ai cũng có thể dùng API tạo hàng loạt tài khoản rác.
   - **Không** chạy `supabase config push`: `config.toml` là cấu hình cho local (bật email đăng nhập dev,
     `skip_nonce_check`). Cấu hình production bằng Dashboard.
   - Nên bật CAPTCHA (Cloudflare Turnstile) trong Authentication → Attack Protection.
   - Thêm `https://<domain>/auth/callback` vào mục Redirect URLs.
2. **Vercel:** đặt `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, rồi deploy.
3. **Android (sau):** đóng gói PWA bằng TWA (Bubblewrap) hoặc Capacitor.

## MCP Supabase cho Claude Code

`.mcp.json` đọc token từ biến môi trường, không chứa secret. Đặt trước khi mở Claude Code:

```bash
export SUPABASE_PROJECT_REF=...        # Dashboard → Project Settings
export SUPABASE_ACCESS_TOKEN=...       # Account → Access Tokens
```

## Ảnh

Ảnh gốc Vecteezy nằm trong `assets/source/`. Chạy `npm run assets:build` để xuất bản webp đã tối ưu
vào `public/images/` và tạo icon PWA. Giấy phép và ghi nguồn xem ở [assets/CREDITS.md](assets/CREDITS.md).
