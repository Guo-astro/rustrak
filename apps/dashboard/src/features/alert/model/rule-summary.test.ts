import { describe, expect, it } from 'vitest';
import { cooldownUnit } from './rule-summary';

describe('cooldownUnit', () => {
  it('reads minutes in the largest whole unit', () => {
    expect(cooldownUnit(0)).toBeNull();
    expect(cooldownUnit(5)).toEqual({ unit: 'minute', value: 5 });
    expect(cooldownUnit(60)).toEqual({ unit: 'hour', value: 1 });
    expect(cooldownUnit(90)).toEqual({ unit: 'minute', value: 90 });
    expect(cooldownUnit(2880)).toEqual({ unit: 'day', value: 2 });
  });
});
