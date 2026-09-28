import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/offline"];

// Làm mới session Supabase mỗi lần điều hướng và chặn route game khi chưa đăng nhập.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims(): xác minh JWT tại chỗ (không gọi Auth server mỗi lần điều hướng) và tự làm mới
  // session khi token sắp hết hạn.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;

  const path = request.nextUrl.pathname;
  // Cho trang chủ có ?code=… (OAuth quay về Site URL) đi qua để app/page.tsx chuyển sang callback.
  const isOAuthReturn = path === "/" && request.nextUrl.searchParams.has("code");
  if (!user && !isOAuthReturn && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|icons/|sw\.js|manifest\.webmanifest|favicon\.ico|apple-icon\.png).*)"],
};
