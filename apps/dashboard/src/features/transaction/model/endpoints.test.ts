import { describe, expect, it } from 'vitest';
import {
  axisDuration,
  endpointHref,
  failureTone,
  perMinute,
  windowHours,
} from './endpoints';

describe('failureTone', () => {
  it('stays quiet under 1%, warns from 1%, alarms from 5%', () => {
    expect(failureTone(0.005)).toBeNull();
    expect(failureTone(0.02)).toBe('warning');
    expect(failureTone(0.05)).toBe('bad');
  });
});

describe('perMinute', () => {
  it('spreads the calls over the window', () => {
    expect(perMinute(1440, 24)).toBe(1);
  });
});

describe('endpointHref', () => {
  it('keeps the name, the op and the window', () => {
    expect(
      endpointHref(
        3,
        { name: 'GET /a?b', op: 'http.server' },
        { period: '7d' },
      ),
    ).toBe(
      '/projects/3/performance/summary?name=GET+%2Fa%3Fb&op=http.server&period=7d',
    );
  });

  it('leaves out what is not set', () => {
    expect(endpointHref(3, { name: 'job', op: null })).toBe(
      '/projects/3/performance/summary?name=job',
    );
  });
});

describe('windowHours', () => {
  it('reads hours and days, and nothing for all time', () => {
    expect(windowHours('24h')).toBe(24);
    expect(windowHours('14d')).toBe(336);
    expect(windowHours('all')).toBeUndefined();
  });
});

describe('axisDuration', () => {
  it('reads short on an axis', () => {
    expect(axisDuration(0)).toBe('0 ms');
    expect(axisDuration(420.6)).toBe('421 ms');
    expect(axisDuration(2000)).toBe('2 s');
    expect(axisDuration(1250)).toBe('1.3 s');
  });
});
