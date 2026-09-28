import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/lib/types/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// Client cho Server Component / Route Handler (SSR). Vẫn dùng key công khai + session người dùng.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Gọi từ Server Component (không set cookie được) — proxy.ts đã làm mới session.
        }
      },
    },
  });
}

export type PlayerUser = { id: string; email: string | null; user_metadata: Record<string, unknown> };

// Trả về user + profile hiện tại (hoặc null).
// getClaims(): xác minh chữ ký JWT ngay tại server (khoá bất đối xứng, JWKS được cache) nên
// không tốn 1 lượt gọi sang Auth server mỗi request như getUser(); Supabase tự quay về
// getUser() nếu project còn dùng khoá đối xứng cũ.
// cache(): layout và page trong cùng 1 request chỉ xác minh + đọc hồ sơ một lần.
export const getCurrentPlayer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null, profile: null };
  const user: PlayerUser = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
});
