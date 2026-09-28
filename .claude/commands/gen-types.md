---
description: Sinh lại TypeScript types từ schema Supabase local
---

Chạy:

```bash
supabase gen types typescript --local > lib/types/database.types.ts
```

Sau đó:
- Kiểm tra file `lib/types/database.types.ts` đã cập nhật (bảng/cột mới xuất hiện).
- Nếu có type dùng chung cần đặt tên gọn (vd `Profile`, `MarketListing`), tạo alias trong
  `lib/types/index.ts` trỏ tới các bảng tương ứng.
- Báo tôi những chỗ code đang dùng type cũ có thể bị lỗi sau khi đổi schema.
