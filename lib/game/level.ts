// Chỉ để HIỂN THỊ thanh tiến độ; cấp thật do server tính (public._level_for_xp).
export function xpForLevel(level: number): number {
  return 30 * (level - 1) ** 2;
}

export function levelProgress(xp: number, level: number): number {
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return Math.min(1, Math.max(0, (xp - from) / (to - from)));
}
