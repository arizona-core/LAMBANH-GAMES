---
description: Rà soát bảo mật RLS + nguyên tắc "server quyết định" cho phần vừa làm
argument-hint: [bảng hoặc function cần rà, để trống = toàn bộ thay đổi chưa commit]
---

Rà soát bảo mật cho: **$ARGUMENTS** (nếu trống, rà toàn bộ thay đổi chưa commit).

Dùng subagent **security-reviewer**. Kiểm tra:
- Mọi bảng có `enable row level security` chưa? Có policy nào vô tình cho client
  `insert/update` cột kinh tế (coins, gem, inventory, listing, transactions_log) không?
- Client có nơi nào tự tính phần thưởng/tiền/kết quả thay vì gọi Edge Function không?
- Edge Function có: check `auth.uid()`, validate input, chạy transaction, chống tự-giao-dịch
  và giới hạn tần suất (chống bot/smurf) chưa?
- Có secret (`service_role`, token) lọt vào code client hoặc commit không?
- Có chỗ nào thêm thanh toán/quy đổi bằng tiền thật không? (dự án cấm)
- Số tiền có dùng số nguyên không?

Trả kết quả dạng danh sách phát hiện, mỗi mục: mức độ (Cao/Trung/Thấp), vị trí file, và
cách sửa cụ thể.
