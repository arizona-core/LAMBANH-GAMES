---
description: Tạo commit theo chuẩn Conventional Commits cho thay đổi hiện tại
---

1. Chạy `git status` và `git diff` để xem thay đổi.
2. **Trước khi commit**, kiểm tra nhanh: không có secret/`.env`/`service_role` trong diff.
3. Gợi ý 1 commit message theo Conventional Commits:
   `feat|fix|chore|refactor|docs(scope): mô tả ngắn`
   (vd: `feat(market): thêm Edge Function buy-listing an toàn`).
4. `git add` các file liên quan rồi commit với message đó.
5. KHÔNG tự `git push` (đã đặt cần hỏi trước ở settings) — hỏi tôi nếu muốn push.
