import type { MonitorStatsBucket } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { successRate, tickStatus, windowDuration } from './timeline';

const bucket = (counts: Partial<MonitorStatsBucket>): MonitorStatsBucket => ({
  bucket: '2026-10-26T10:00:00Z',
  ok: 0,
  error: 0,
  missed: 0,
  timeout: 0,
  in_progress: 0,
  avg_duration_ms: null,
  duration_count: 0,
  ...counts,
});

describe('tickStatus', () => {
  it('shows the worst thing that happened in the bucket', () => {
    expect(tickStatus(bucket({ ok: 3, error: 1, missed: 1 }))).toBe('error');
    expect(tickStatus(bucket({ ok: 3, timeout: 1, missed: 1 }))).toBe(
      'timeout',
    );
    expect(tickStatus(bucket({ ok: 3, missed: 1 }))).toBe('missed');
    expect(tickStatus(bucket({ ok: 1, in_progress: 1 }))).toBe('in_progress');
    expect(tickStatus(bucket({ ok: 2 }))).toBe('ok');
  });

  it('leaves a bucket with nothing in it empty', () => {
    expect(tickStatus(bucket({}))).toBe('empty');
  });
});

describe('successRate', () => {
  it('counts finished runs only', () => {
    expect(
      successRate([
        bucket({ ok: 3, error: 1, in_progress: 5 }),
        bucket({ missed: 1 }),
      ]),
    ).toBe(0.6);
  });

  it('has no rate without a finished run', () => {
    expect(successRate([bucket({ in_progress: 1 })])).toBeNull();
  });
});

describe('windowDuration', () => {
  it('weighs each bucket by the runs that reported a duration', () => {
    expect(
      windowDuration([
        bucket({ ok: 1, avg_duration_ms: 1000, duration_count: 1 }),
        bucket({ ok: 3, avg_duration_ms: 3000, duration_count: 3 }),
        bucket({}),
      ]),
    ).toBe(2500);
  });

  it('leaves out the runs that reported no duration', () => {
    // Nine errors without a duration beside a 1 s run: the mean is of 1 s and 3 s.
    expect(
      windowDuration([
        bucket({ ok: 1, error: 9, avg_duration_ms: 1000, duration_count: 1 }),
        bucket({ ok: 1, avg_duration_ms: 3000, duration_count: 1 }),
      ]),
    ).toBe(2000);
  });
});
