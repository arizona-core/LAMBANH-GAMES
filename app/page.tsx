import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/supabase/server";

// Điểm vào: chưa đăng nhập → /login, chưa có tiệm → /onboarding, còn lại → /shop.
export default async function Index() {
  const { user, profile } = await getCurrentPlayer();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  redirect("/shop");
}
