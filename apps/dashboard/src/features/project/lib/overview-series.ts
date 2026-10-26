/** A window's length in hours: `24h` is 24, `7d` is 168. */
export function periodHours(period: `${number}${'h' | 'd'}`): number {
  const value = Number.parseInt(period, 10);
  return period.endsWith('d') ? value * 24 : value;
}

/**
 * The newest half of a series fetched over twice the window, each bucket
 * paired with the total of the bucket exactly one window before it.
 *
 * One request instead of two: the doubled window is zero-filled from
 * `now - 2P`, so the bucket a period before the current window's `i`-th is
 * the doubled series' `i`-th, counted from its start.
 */
export function withPreviousPeriod<T extends { total: number }>(
  doubled: T[],
): (T & { previous: number })[] {
  const half = Math.floor(doubled.length / 2);
  return doubled.slice(half).map((point, index) => ({
    ...point,
    previous: doubled[index]?.total ?? 0,
  }));
}
