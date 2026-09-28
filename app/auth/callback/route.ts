import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth quay về đây với ?code=… → đổi lấy session (cookie) rồi vào game.
// Lỗi (từ Supabase/Google hoặc lúc đổi code) được chuyển sang /login để hiển thị lý do.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  let reason = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    reason = error.message;
  }

  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth");
  if (reason) url.searchParams.set("reason", reason.slice(0, 200));
  return NextResponse.redirect(url);
}
