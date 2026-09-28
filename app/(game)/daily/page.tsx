import type { Metadata } from "next";
import { ScreenHeader } from "@/components/ScreenHeader";
import { todayVN } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import { DailyView } from "./DailyView";

export const metadata: Metadata = { title: "Điểm danh" };

function yesterdayVN() {
  return todayVN(new Date(Date.now() - 24 * 3600 * 1000));
}

export default async function DailyPage() {
  const { profile } = await requirePlayer();
  const today = todayVN();
  const claimedToday = profile.last_checkin === today;
  // Chuỗi còn hiệu lực nếu đã điểm danh hôm nay hoặc hôm qua; nếu không sẽ bắt đầu lại từ 1.
  const alive = claimedToday || profile.last_checkin === yesterdayVN();
  const streak = alive ? profile.checkin_streak : 0;

  return (
    <main className="app">
      <div className="screen">
        <ScreenHeader title="Điểm danh" gems={profile.gems} />
        <DailyView streak={streak} claimedToday={claimedToday} />
      </div>
    </main>
  );
}
