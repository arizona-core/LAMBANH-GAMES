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
