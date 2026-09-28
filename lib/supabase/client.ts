import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// Client cho browser: chỉ dùng key công khai, mọi truy vấn bị RLS giới hạn.
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
