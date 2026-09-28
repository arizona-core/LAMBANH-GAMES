import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth quay về đây với ?code=… → đổi lấy session (cookie) rồi vào game.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
