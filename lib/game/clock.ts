// Đồng hồ game — trùng public._game_minute: 1 giây thật = 1 phút game, chung cả server.
// Tiệm mở cả ngày lẫn đêm (migration 0017) — chỉ đóng khi chủ tiệm tự đóng hoặc offline.
// Giờ game chỉ đổi lượng khách và ánh sáng cảnh tiệm. Chỉ để HIỂN THỊ.

export const DAY_MINUTES = 24 * 60;

export type GameClock = {
  minuteOfDay: number;
  hour: number;
  minute: number;
};

export function gameClock(nowMs: number): GameClock {
  const minuteOfDay = Math.floor(nowMs / 1000) % DAY_MINUTES;
  return {
    minuteOfDay,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
}

export function formatGameTime(c: Pick<GameClock, "hour" | "minute">): string {
  return `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
}

// Lượng khách theo giờ game — trùng public._traffic_mult (migration 0017). Chỉ để HIỂN THỊ.
export type Traffic = "rush" | "normal" | "quiet";

const TRAFFIC_BANDS: { from: number; to: number; mult: number }[] = [
  { from: 0, to: 420, mult: 0.4 }, // đêm khuya

  { from: 420, to: 540, mult: 1.3 },
  { from: 540, to: 660, mult: 0.8 },
  { from: 660, to: 780, mult: 1.8 },
  { from: 780, to: 960, mult: 0.5 },
  { from: 960, to: 1080, mult: 0.9 },
  { from: 1080, to: 1260, mult: 1.7 },
  { from: 1260, to: 1380, mult: 0.8 },
  { from: 1380, to: 1440, mult: 0.4 },
];

export function trafficMult(minuteOfDay: number): number {
  return TRAFFIC_BANDS.find((b) => minuteOfDay >= b.from && minuteOfDay < b.to)?.mult ?? 0;
}

export function trafficLevel(minuteOfDay: number): Traffic {
  const m = trafficMult(minuteOfDay);
  if (m >= 1.5) return "rush";
  if (m <= 0.5) return "quiet";
  return "normal";
}

/** Giờ cao điểm kế tiếp (phút trong ngày game), hoặc null nếu đang cao điểm. */
export function nextRush(minuteOfDay: number): { start: number; end: number; inSeconds: number } | null {
  if (trafficLevel(minuteOfDay) === "rush") return null;
  const rushes = TRAFFIC_BANDS.filter((b) => b.mult >= 1.5);
  const next = rushes.find((b) => b.from > minuteOfDay) ?? rushes[0];
  const inSeconds = (next.from - minuteOfDay + DAY_MINUTES) % DAY_MINUTES;
  return { start: next.from, end: next.to, inSeconds };
}

/** Phút trong ngày → "11:00" */
export function formatMinute(minuteOfDay: number): string {
  return formatGameTime({ hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 });
}
