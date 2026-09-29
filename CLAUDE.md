# Sweet Shop — hướng dẫn cho Claude Code

Game web mô phỏng **làm bánh & kinh doanh tiệm bánh** có nền kinh tế và cạnh tranh
**online giữa người chơi thật**. Người chơi làm bánh (mini-game) → bán → kiếm xu →
nâng cấp/trang trí → leo bảng xếp hạng, giao dịch ở chợ, nhận đơn của khách.

Kế hoạch đầy đủ: `docs/PLAN.md`. Danh sách màn hình + bản thiết kế: `docs/screens.md`.
Bộ nhận diện (màu/font/token): xem phần import bên dưới.

@docs/design-system.md

---

## Tech stack (đã chốt)

- **Frontend:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript (strict) + **Phaser 3** cho mini-game.
  Next 16 khác bản cũ: `middleware` → `proxy.ts`, `params/searchParams/cookies()` là async.
  Đọc docs đi kèm ở `node_modules/next/dist/docs/` trước khi dùng API lạ (xem `AGENTS.md`).
- **Deploy:** Vercel. Có **PWA** ngay từ đầu (manifest + service worker). Lên Android sau bằng **TWA (Bubblewrap)** hoặc **Capacitor** — KHÔNG viết lại codebase.
- **Backend/DB:** **Supabase** — Auth (chỉ Google OAuth ở production), Postgres, Row Level Security, Realtime, Edge Functions (Deno/TypeScript), Storage.
  Ở local có thêm form "đăng nhập dev" (email) chỉ hiện khi `npm run dev`, để chơi thử khi chưa cấu hình Google.
- **Thanh toán:** KHÔNG có. Game không nạp/rút tiền thật; xu và gem chỉ kiếm trong game.
- **State client:** dữ liệu server đọc trong Server Component, sau mỗi hành động gọi `router.refresh()`;
  Zustand cho state UI (toast); Phaser giữ state của scene game.
- **Font:** Baloo 2 (tiêu đề) + Nunito (nội dung) — Fredoka không có bộ chữ tiếng Việt.

## Nguyên tắc cốt lõi — "Client hiển thị, Server quyết định"

Đây là luật số 1, không phá vỡ:

- Client (Next.js/Phaser) **chỉ hiển thị và gửi ý định** (intent). Nó KHÔNG bao giờ tự
  quyết định số tiền, phần thưởng, kết quả giao dịch, hay tự ghi các bảng kinh tế.
- **Mọi thay đổi tiền/tài sản/giao dịch PHẢI đi qua Supabase Edge Function** chạy trên
  server: xác thực JWT bằng `auth.getUser()`, validate input bằng zod, rồi gọi **hàm Postgres**
  qua `rpc()`. Hàm Postgres chạy trọn trong 1 transaction, khóa dòng `FOR UPDATE`, ghi
  `transactions_log`. (supabase-js không chạy được transaction nhiều câu lệnh, nên logic
  kinh tế nằm trong SQL — xem `supabase/migrations/*_game_functions.sql`.)
- Hàm kinh tế chỉ `service_role` được `execute`; client gọi thẳng `rpc()` sẽ bị từ chối.
- **Bật RLS trên mọi bảng.** Client chỉ được `select` dữ liệu của chính mình (và dữ liệu
  công khai như bảng xếp hạng, listing chợ). Client **không có** quyền `insert/update`
  trực tiếp lên `profiles.coins`, `inventory`, `market_listings`, `transactions_log`…
- **`service_role` key CHỈ dùng trong Edge Function**, không bao giờ xuất hiện ở client.
- Coi mọi input từ client là **không đáng tin**: kiểm tra số lượng, giá, quyền sở hữu,
  giới hạn chống bot/smurf ở server trước khi ghi.

Khi viết bất kỳ tính năng nào chạm tới xu/gem/kho/chợ/đơn hàng: dừng lại và tự hỏi
"client có tự quyết được gì không?" — nếu có, đưa logic đó về hàm Postgres + Edge Function.
Công thức nào client cần để HIỂN THỊ trước (giá, phí, số sao) thì chép sang `lib/game/scoring.ts`
kèm comment "trùng server" và test ở `tests/`.

## Cấu trúc thư mục (quy ước)

```
app/                      # Next.js App Router
  (auth)/                 # login, onboarding
  (game)/                 # shop, kitchen, order/[visitId], reviews, market, leaderboard, store, daily, settings
  auth/callback/          # nhận code Google OAuth → session
  manifest.ts, globals.css (design tokens + lớp dùng chung)
proxy.ts                  # làm mới session + chặn route khi chưa đăng nhập (Next 16)
components/               # HUD, BottomNav, ScreenHeader, ItemImage, Modal, useAction…
game/                     # Phaser: scenes/BakeScene.ts (trộn + nấu), scenes/IsoShopScene.ts (tiệm isometric),
                          #   shop/layout.ts (bố cục + theme), create*Game.ts (import động, chỉ browser)
lib/
  supabase/               # client.ts (browser), server.ts (SSR + getCurrentPlayer), env.ts
  api/actions.ts          # callAction(): gọi Edge Function có kiểu
  game/                   # queries, scoring, clock (giờ game), orders (kiểu đơn), format, errors, constants
  store/                  # Zustand (toast)
  types/                  # database.types.ts (auto-gen) + alias trong index.ts
supabase/
  migrations/             # 0001 schema+RLS · 0002 hàm kinh tế · 0003 danh mục · 0004 gia cố · 0005 khách + đơn · 0006–0007 ảnh/avatar · 0008 đánh giá + trang trí · 0011 sổ công thức 72 món (docs/Bakery_Recipe_Database.docx)
  functions/              # _shared/action.ts + mỗi action 1 thư mục
  tests/database/         # pgTAP (npx supabase test db)
tests/                    # Vitest cho lib/game
scripts/                  # build-assets.mjs (tối ưu ảnh), smoke-functions.mjs (e2e API)
assets/source/            # ảnh gốc Vecteezy (đã đổi tên) → public/images qua npm run assets:build
docs/                     # PLAN.md, design-system.md, screens.md, project/ (mockup .dc.html)
public/                   # images/, icons/, sw.js
```

## Quy ước code

- TypeScript **strict**; không dùng `any` trừ khi thật sự cần và có `// TODO`.
- Đặt tên: component `PascalCase`, hàm/biến `camelCase`, hằng `SCREAMING_SNAKE`,
  bảng/cột Postgres `snake_case`.
- Tiền tệ lưu là **số nguyên** (đơn vị nhỏ nhất), không dùng float cho xu/gem.
- Mỗi Edge Function: (1) xác thực user, (2) validate input bằng zod, (3) chạy logic
  trong transaction, (4) trả JSON có `{ ok, data?, error? }`.
- Migration không sửa file cũ đã chạy; tạo migration mới. Mọi bảng có RLS + policy.
- UI bám theo `docs/design-system.md` (màu, font, bo góc, bóng nút kiểu game).

## Lệnh hay dùng

```bash
npm run dev               # Next.js local (cần .env.local, xem README)
npm run build             # build production
npm run lint              # eslint
npm run typecheck         # next typegen + tsc --noEmit
npm run test              # Vitest (lib/game)
npm run test:db           # pgTAP: kinh tế + RLS (cần Supabase local)
npm run assets:build      # tối ưu ảnh assets/source → public/images + icon PWA

npx supabase start        # Supabase local (Docker)
npx supabase db reset     # áp lại toàn bộ migration
npx supabase functions serve   # Edge Functions local
node scripts/smoke-functions.mjs   # e2e gọi thật từng Edge Function
npm run gen:types         # sinh lib/types/database.types.ts
```

## TUYỆT ĐỐI KHÔNG

- Không đặt secret (`service_role`, access token) vào code client hay commit.
- Không cho client ghi trực tiếp các bảng kinh tế; không tính phần thưởng ở client.
- Không tắt RLS để "cho nhanh".
- Không sửa file trong `supabase/migrations/` đã được apply — tạo migration mới.
- Không thêm **thanh toán bằng tiền thật** (không Stripe, không gói nạp, không quy đổi xu/gem
  ra tiền). Cửa hàng chỉ bán bằng xu/gem kiếm trong game (xem PLAN).

## Công cụ có sẵn

- Slash commands: `/new-screen`, `/edge-function`, `/migration`, `/rls-review`,
  `/gen-types`, `/commit` (xem `.claude/commands/`).
- Subagents: `supabase-architect`, `security-reviewer`, `game-ui-engineer`
  (xem `.claude/agents/`).
- MCP: server `supabase` (đọc schema/dữ liệu) — cấu hình ở `.mcp.json`.

Khi bắt đầu một tính năng lớn: đọc `docs/PLAN.md`, lập kế hoạch ngắn, rồi làm theo
lộ trình theo giai đoạn. Ưu tiên async (tiết kiệm quota Supabase free tier), realtime
để sau cùng.
