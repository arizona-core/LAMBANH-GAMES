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

// Trả về user + profile hiện tại (hoặc null). Dùng getUser() để xác minh với Auth server.
// cache(): layout và page trong cùng 1 request chỉ gọi Auth/DB một lần.
export const getCurrentPlayer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
});
