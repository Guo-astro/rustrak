/**
 * Selectable time windows for the project overview.
 *
 * The overview and the releases pages share them, so a window picked on one
 * means the same thing on the other.
 */
export const OVERVIEW_PERIODS = ['24h', '7d', '14d', '30d'] as const;

export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

/** What `?period=` can hold. Absent is the default window, not all time. */
export const PERIOD_CHOICES = [...OVERVIEW_PERIODS, 'all'] as const;
export type PeriodChoice = (typeof PERIOD_CHOICES)[number];

/** The window a page opens on: two weeks, as Sentry's releases do. */
export const DEFAULT_PERIOD: OverviewPeriod = '14d';

/** Narrow a raw `?period=` value to a supported window, or undefined ("All"). */
export function parseOverviewPeriod(raw?: string): OverviewPeriod | undefined {
  return OVERVIEW_PERIODS.find((p) => p === raw);
}

/**
 * Bucket width, in hours, for a window's charts.
 *
 * A 30-day window in hourly buckets is 720 bars in a tile a few hundred pixels
 * wide, which renders as noise. Widening the bucket with the window keeps the
 * bar count roughly constant, at 24 to 60 bars for every fixed period.
 *
 * "All" (`undefined`) is unbounded by definition, so it takes the widest
 * bucket; the charts additionally cap how many bars they draw, which is what
 * actually protects a years-old project.
 */
export function overviewInterval(period?: OverviewPeriod): number {
  switch (period) {
    case '24h':
      return 1;
    case '7d':
      return 3;
    case '14d':
      return 6;
    case '30d':
      return 12;
    default:
      return 24;
  }
}

/** How a crash-free rate reads: healthy from 99%, worrying under 95%. */
export function healthTone(
  rate: number | null | undefined,
): 'good' | 'warning' | 'bad' | null {
  if (rate == null) return null;
  if (rate >= 0.99) return 'good';
  if (rate >= 0.95) return 'warning';
  return 'bad';
}

/**
 * A version split the way SDKs name them, `package@version+build`: the
 * package is what the reader already knows, the version what they scan for.
 */
export function splitVersion(raw: string): {
  package: string | null;
  version: string;
} {
  const at = raw.lastIndexOf('@');
  // `@scope/pkg` alone is a package name, not a version.
  if (at <= 0) return { package: null, version: raw };
  return { package: raw.slice(0, at), version: raw.slice(at + 1) };
}
