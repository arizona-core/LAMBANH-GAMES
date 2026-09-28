---
description: Tạo một Supabase Edge Function an toàn cho một hành động kinh tế
argument-hint: [tên-action] (vd: buy-listing, sell-item, claim-daily, place-order)
---

Tạo Edge Function **$ARGUMENTS** trong `supabase/functions/$ARGUMENTS/`.

Đây là nơi "server quyết định", nên bắt buộc theo khuôn:

Dùng khuôn có sẵn `serveAction(schema, run)` ở `supabase/functions/_shared/action.ts` (xem các
function hiện có, vd `buy-listing/index.ts`). Khuôn đã lo (1) xác thực JWT bằng
`admin.auth.getUser(token)` (`auth.uid()` chỉ có trong SQL, không dùng được ở Deno),
(2) validate zod `.strict()`, (5) trả `{ ok, data | error }`, CORS.

Việc của bạn:
1. **Logic kinh tế viết thành hàm Postgres** trong migration mới (`/migration`):
   `security definer`, `set search_path = ''`, nhận `p_user uuid` đầu tiên, khóa dòng
   `FOR UPDATE` (nhiều hồ sơ thì khóa theo thứ tự id), kiểm tra điều kiện trên dữ liệu thật
   (đủ xu? sở hữu item? listing còn? không tự mua của mình? `public._rate_limit(...)`),
   ghi `public._log(...)`, lỗi nghiệp vụ `perform public._fail('MA_LOI')`.
   Cuối migration: `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;`
2. **Function Deno**: schema zod + `rpc("ten_ham", { p_user: userId, ... })`. Mã lỗi mới thêm vào
   `KNOWN_ERRORS` trong `_shared/action.ts` và thông điệp tiếng Việt trong `lib/game/errors.ts`.
3. Thêm `[functions.$ARGUMENTS] verify_jwt = false` vào `supabase/config.toml` (đã tự xác minh JWT trong code).
4. Số tiền là số nguyên; không dùng float. Không bao giờ nhận số tiền/phần thưởng từ client.

Sau khi viết:
- Thêm kiểu input/output vào map `Actions` trong `lib/api/actions.ts`; UI gọi qua hook `useAction`.
- Thêm test pgTAP vào `supabase/tests/database/` và 1 bước vào `scripts/smoke-functions.mjs`.
- Test local: `npx supabase db reset && npx supabase test db`, rồi `npx supabase functions serve`
  + `node scripts/smoke-functions.mjs`.

Kết thúc bằng việc nhờ subagent **security-reviewer** rà lại lỗ hổng "client tự quyết".
