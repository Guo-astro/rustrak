import { describe, expect, it } from 'vitest';
import {
  defaultSelectedSpanId,
  fillBuckets,
  resolveAgentFilters,
} from './filters';

describe('fillBuckets', () => {
  const hour = (h: number) => new Date(Date.UTC(2026, 0, 1, h)).toISOString();
  const point = (h: number, value: number) => ({ bucket: hour(h), value });

  it('puts the empty buckets back between and after the busy ones', () => {
    const filled = fillBuckets(
      [point(9, 2), point(11, 5)],
      1,
      undefined,
      (bucket) => ({ bucket, value: 0 }),
      Date.UTC(2026, 0, 1, 12, 30),
    );
    expect(filled.map((p) => p.value)).toEqual([2, 0, 5, 0]);
    expect(filled[1]?.bucket).toBe(hour(10));
  });

  it('starts at the window, not at the first busy bucket', () => {
    const filled = fillBuckets(
      [point(11, 5)],
      1,
      3,
      (bucket) => ({ bucket, value: 0 }),
      Date.UTC(2026, 0, 1, 12, 30),
    );
    // 09:30 is the window's start, in the 09:00 bucket.
    expect(filled.map((p) => p.value)).toEqual([0, 0, 5, 0]);
  });
});

describe('resolveAgentFilters', () => {
  it('widens the bucket with the window', () => {
    // A 30-day window bucketed hourly is 720 points on a chart a few hundred
    // pixels wide — noise, not detail.
    expect(resolveAgentFilters({ period: '24h' }).intervalHours).toBe(1);
    expect(resolveAgentFilters({ period: '30d' }).intervalHours).toBe(24);
  });

  it('falls back to all time for an unrecognized period', () => {
    // A stale or hand-edited URL should still render something, and showing
    // more data than asked for is the safe direction to fail in.
    const filters = resolveAgentFilters({ period: 'last-tuesday' });

    expect(filters.period).toBeUndefined();
    expect(filters.periodHours).toBeUndefined();
  });

  it('treats an empty environment as no filter', () => {
    // `?environment=` is what a cleared dropdown produces; it must not become
    // a query for spans whose environment is the empty string.
    expect(
      resolveAgentFilters({ environment: '' }).environment,
    ).toBeUndefined();
  });
});

describe('defaultSelectedSpanId', () => {
  const span = (
    id: string,
    gen_ai_operation_type: string | null,
    start_timestamp: string,
  ) => ({ id, gen_ai_operation_type, start_timestamp });

  it('opens on the first LLM call, not on the agent root', () => {
    // The agent root mostly restates the trace header. The first generation
    // is where the prompt and the answer are.
    const chosen = defaultSelectedSpanId([
      span('agent', 'agent', '2026-08-13T10:00:00Z'),
      span('llm', 'ai_client', '2026-08-13T10:00:02Z'),
    ]);

    expect(chosen).toBe('llm');
  });

  it('picks the earliest LLM call when there are several', () => {
    const chosen = defaultSelectedSpanId([
      span('late', 'ai_client', '2026-08-13T10:00:09Z'),
      span('early', 'ai_client', '2026-08-13T10:00:01Z'),
    ]);

    expect(chosen).toBe('early');
  });

  it('falls back to any AI span when the trace made no model call', () => {
    // A pure tool-calling trace still has something worth opening.
    const chosen = defaultSelectedSpanId([
      span('plain', null, '2026-08-13T10:00:00Z'),
      span('tool', 'tool', '2026-08-13T10:00:01Z'),
    ]);

    expect(chosen).toBe('tool');
  });

  it('is undefined for an empty trace rather than throwing', () => {
    expect(defaultSelectedSpanId([])).toBeUndefined();
  });
  it('orders deterministically when a span has no timestamp', () => {
    // `Date.parse(null ?? '')` is NaN, and a comparator returning NaN leaves
    // the order implementation-defined — the default selection would then
    // depend on the order rows came back in.
    const withoutTimestamp = {
      id: 'no-ts',
      gen_ai_operation_type: 'ai_client',
      start_timestamp: null,
    };
    const early = span('early', 'ai_client', '2026-08-13T10:00:01Z');

    expect(defaultSelectedSpanId([withoutTimestamp, early])).toBe('early');
    expect(defaultSelectedSpanId([early, withoutTimestamp])).toBe('early');
  });
});
