import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/supabase/server";

// Điểm vào: chưa đăng nhập → /login, chưa có tiệm → /onboarding, còn lại → /shop.
export default async function Index({ searchParams }: PageProps<"/">) {
  // Supabase đưa về Site URL kèm ?code=… khi redirect URL không nằm trong danh sách cho phép
  // → chuyển tiếp sang callback để vẫn đăng nhập được.
  const { code } = await searchParams;
  if (typeof code === "string" && code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);

  const { user, profile } = await getCurrentPlayer();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  redirect("/shop");
}
