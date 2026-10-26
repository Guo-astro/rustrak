import type { MonitorStatsBucket } from '@rustrak/client';

/** What one tick of a timeline shows. */
export type TickStatus =
  | 'error'
  | 'timeout'
  | 'missed'
  | 'in_progress'
  | 'ok'
  | 'empty';

/** Worst first: a bucket shows the worst thing that happened in it. */
const ORDER = ['error', 'timeout', 'missed', 'in_progress', 'ok'] as const;

export function tickStatus(bucket: MonitorStatsBucket): TickStatus {
  return ORDER.find((status) => bucket[status] > 0) ?? 'empty';
}

/** The windows a timeline reads: the axis needs a recent edge. */
export const TIMELINE_PERIODS = ['24h', '7d', '30d'] as const;
export type TimelinePeriod = (typeof TIMELINE_PERIODS)[number];

/** Of the runs that finished in the window, the share that went well. */
export function successRate(buckets: MonitorStatsBucket[]): number | null {
  let ok = 0;
  let finished = 0;
  for (const b of buckets) {
    ok += b.ok;
    finished += b.ok + b.error + b.missed + b.timeout;
  }
  return finished ? ok / finished : null;
}

/**
 * The mean duration over the window. A bucket's mean only covers its runs
 * that reported one, which a missed run never does; its finished runs other
 * than missed ones are the weight.
 */
export function windowDuration(buckets: MonitorStatsBucket[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const b of buckets) {
    if (b.avg_duration_ms === null) continue;
    const runs = b.ok + b.error + b.timeout;
    sum += b.avg_duration_ms * runs;
    weight += runs;
  }
  return weight ? sum / weight : null;
}
