---
description: Tạo migration SQL mới kèm RLS policy cho một bảng
argument-hint: [mô tả] (vd: create market_listings, add coins to profiles)
---

Tạo migration mới cho: **$ARGUMENTS**.

Các bước:
1. Chạy `supabase migration new <ten_ngan_gon>` để tạo file trong `supabase/migrations/`.
   KHÔNG sửa migration cũ đã apply — luôn tạo file mới.
2. Viết SQL:
   - Kiểu dữ liệu hợp lý; tiền tệ là `bigint`/`integer` (số nguyên), không float.
   - Khóa ngoại + index cho cột hay lọc/join.
   - `created_at timestamptz default now()`.
3. **Bật RLS**: `alter table <t> enable row level security;`
4. Viết **policy** đúng nguyên tắc "client hiển thị, server quyết định":
   - `select`: chỉ dữ liệu của chính user (`auth.uid() = user_id`) HOẶC dữ liệu công khai
     (bảng xếp hạng, listing chợ đang mở, đánh giá).
   - `insert/update/delete` cho các bảng kinh tế (coins, inventory, market_listings,
     transactions_log): **không cấp cho client** — chỉ `service_role` (Edge Function) ghi được.
   - Với bảng người dùng tự sửa an toàn (vd nội dung đánh giá của họ): giới hạn đúng `user_id`.
5. Nhắc tôi chạy `supabase db reset` (local) để áp lại, rồi `/gen-types` để cập nhật type.

Giải thích ngắn từng policy đã viết và vì sao an toàn.
