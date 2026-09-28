import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/supabase/server";

// Mọi màn game cần: đã đăng nhập + đã mở tiệm.
export default async function GameLayout({ children }: LayoutProps<"/">) {
  const { user, profile } = await getCurrentPlayer();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  return children;
}
