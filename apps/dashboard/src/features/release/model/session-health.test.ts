import { describe, expect, it } from 'vitest';
import { healthTone, splitVersion } from './session-health';

describe('splitVersion', () => {
  it('splits package and version', () => {
    expect(splitVersion('web@2.14.0')).toEqual({
      package: 'web',
      version: '2.14.0',
    });
    expect(splitVersion('@acme/app@1.0.0+42')).toEqual({
      package: '@acme/app',
      version: '1.0.0+42',
    });
  });

  it('keeps a bare version whole', () => {
    expect(splitVersion('1.2.0')).toEqual({ package: null, version: '1.2.0' });
    expect(splitVersion('abc123def')).toEqual({
      package: null,
      version: 'abc123def',
    });
  });
});

describe('healthTone', () => {
  it('tiers at 99% and 95%', () => {
    expect(healthTone(0.995)).toBe('good');
    expect(healthTone(0.97)).toBe('warning');
    expect(healthTone(0.9)).toBe('bad');
    expect(healthTone(null)).toBeNull();
  });
});
