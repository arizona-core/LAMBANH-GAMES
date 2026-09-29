// Nhiệm vụ hằng ngày — kiểu dữ liệu khớp public.get_daily_quests + sắp xếp hiển thị.
// Tiến độ và phần thưởng do SERVER tính; client chỉ hiển thị.

export type Quest = {
  code: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward_coins: number;
  reward_gems: number;
  reward_xp: number;
  claimed: boolean;
};

export type DailyQuests = { day: string; resets_at: string; quests: Quest[] };

export function questDone(q: Quest): boolean {
  return q.progress >= q.target;
}

/** Thứ tự: nhận được ngay → đang làm (gần xong trước) → đã nhận. */
export function sortQuests(quests: Quest[]): Quest[] {
  const rank = (q: Quest) => (q.claimed ? 2 : questDone(q) ? 0 : 1);
  return [...quests].sort((a, b) => rank(a) - rank(b) || b.progress / b.target - a.progress / a.target);
}
