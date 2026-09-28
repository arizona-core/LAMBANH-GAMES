const nf = new Intl.NumberFormat("vi-VN");

/** 2480 → "2.480" */
export function formatNumber(n: number): string {
  return nf.format(n);
}

/** 18400 → "18,4k" (bảng xếp hạng) */
export function formatCompact(n: number): string {
  if (n < 10_000) return nf.format(n);
  if (n < 1_000_000) return `${nf.format(Math.floor(n / 100) / 10)}k`;
  return `${nf.format(Math.floor(n / 100_000) / 10)}M`;
}

/** Ngày hiện tại theo giờ Việt Nam (YYYY-MM-DD), khớp với public._today() ở server. */
export function todayVN(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}
