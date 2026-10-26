import type { AlertHistory } from '@rustrak/client';

/** The cooldowns offered as one click: every time, 5 minutes, an hour, a day. */
export const COOLDOWN_PRESETS = [0, 5, 60, 1440] as const;

/** The cooldown a new rule starts with: an hour, so a burst pages once. */
export const DEFAULT_COOLDOWN = 60;

/** A cooldown in the largest unit that divides it; `null` for none. */
export function cooldownUnit(
  minutes: number,
): { unit: 'minute' | 'hour' | 'day'; value: number } | null {
  if (minutes <= 0) return null;
  if (minutes % 1440 === 0) return { unit: 'day', value: minutes / 1440 };
  if (minutes % 60 === 0) return { unit: 'hour', value: minutes / 60 };
  return { unit: 'minute', value: minutes };
}

const DAY = 86_400_000;

/**
 * Deliveries per UTC day over the last `days` days, oldest first, with the
 * empty days present -- the bars under a rule's history.
 */
export function historyByDay(
  history: Pick<AlertHistory, 'created_at' | 'status'>[],
  days: number,
  now: number,
) {
  const today = Math.floor(now / DAY) * DAY;
  const buckets = Array.from({ length: days }, (_, i) => ({
    t: today - (days - 1 - i) * DAY,
    sent: 0,
    failed: 0,
    skipped: 0,
  }));
  for (const row of history) {
    const day = Math.floor(Date.parse(row.created_at) / DAY) * DAY;
    const bucket = buckets.find((b) => b.t === day);
    if (!bucket) continue;
    if (row.status === 'sent') bucket.sent += 1;
    else if (row.status === 'failed') bucket.failed += 1;
    else if (row.status === 'skipped') bucket.skipped += 1;
  }
  return buckets;
}
