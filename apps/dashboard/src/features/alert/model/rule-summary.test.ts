import type { AlertHistory } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { cooldownUnit, historyByDay } from './rule-summary';

describe('cooldownUnit', () => {
  it('reads minutes in the largest whole unit', () => {
    expect(cooldownUnit(0)).toBeNull();
    expect(cooldownUnit(5)).toEqual({ unit: 'minute', value: 5 });
    expect(cooldownUnit(60)).toEqual({ unit: 'hour', value: 1 });
    expect(cooldownUnit(90)).toEqual({ unit: 'minute', value: 90 });
    expect(cooldownUnit(2880)).toEqual({ unit: 'day', value: 2 });
  });
});

const delivery = (created_at: string, status: AlertHistory['status']) =>
  ({ created_at, status }) as AlertHistory;

describe('historyByDay', () => {
  it('counts deliveries per day, every day of the window present', () => {
    const now = Date.parse('2026-10-26T12:00:00Z');
    const days = historyByDay(
      [
        delivery('2026-10-26T09:00:00Z', 'sent'),
        delivery('2026-10-26T08:00:00Z', 'failed'),
        delivery('2026-10-24T08:00:00Z', 'skipped'),
        delivery('2026-10-24T07:00:00Z', 'sent'),
        delivery('2026-09-01T07:00:00Z', 'sent'),
      ],
      3,
      now,
    );
    expect(days).toEqual([
      { t: Date.parse('2026-10-24T00:00:00Z'), sent: 1, failed: 0, skipped: 1 },
      { t: Date.parse('2026-10-25T00:00:00Z'), sent: 0, failed: 0, skipped: 0 },
      { t: Date.parse('2026-10-26T00:00:00Z'), sent: 1, failed: 1, skipped: 0 },
    ]);
  });
});
