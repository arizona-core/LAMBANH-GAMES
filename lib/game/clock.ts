// Đồng hồ game — trùng public._game_minute: 1 giây thật = 1 phút game, chung cả server.
// Tiệm mở 7:00 → 24:00 giờ game. Chỉ để HIỂN THỊ; server tự kiểm tra giờ mở cửa.

export const OPEN_MINUTE = 7 * 60;
export const DAY_MINUTES = 24 * 60;

export type GameClock = {
  minuteOfDay: number;
  hour: number;
  minute: number;
  open: boolean;
  /** Số giây thật còn lại tới lúc mở cửa (0 nếu đang mở). */
  secondsToOpen: number;
  /** Số giây thật còn lại tới lúc đóng cửa (0 nếu đang đóng). */
  secondsToClose: number;
};

export function gameClock(nowMs: number): GameClock {
  const minuteOfDay = Math.floor(nowMs / 1000) % DAY_MINUTES;
  const open = minuteOfDay >= OPEN_MINUTE;
  return {
    minuteOfDay,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    open,
    secondsToOpen: open ? 0 : OPEN_MINUTE - minuteOfDay,
    secondsToClose: open ? DAY_MINUTES - minuteOfDay : 0,
  };
}

export function formatGameTime(c: Pick<GameClock, "hour" | "minute">): string {
  return `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
}

// Lượng khách theo giờ game — trùng public._traffic_mult (migration 0009). Chỉ để HIỂN THỊ.
export type Traffic = "closed" | "rush" | "normal" | "quiet";

const TRAFFIC_BANDS: { from: number; to: number; mult: number }[] = [
  { from: 0, to: 420, mult: 0 },
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
  if (m === 0) return "closed";
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
