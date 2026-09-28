// Biến môi trường công khai (an toàn cho browser). KHÔNG đặt service_role ở đây.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Tạo .env.local theo hướng dẫn trong README (lấy giá trị từ `npx supabase status`).",
  );
}
