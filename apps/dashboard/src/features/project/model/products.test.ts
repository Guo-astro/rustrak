import { describe, expect, it } from 'vitest';
import { keepsProduct, orderedProducts } from './products';

describe('orderedProducts', () => {
  it('puts the saved order first and the rest after, in default order', () => {
    expect(orderedProducts(['logs', 'issues'])).toEqual([
      'logs',
      'issues',
      'feedback',
      'releases',
      'performance',
      'crons',
      'agents',
    ]);
  });

  it('drops duplicates from the saved order', () => {
    expect(
      orderedProducts(['logs', 'logs']).filter((p) => p === 'logs'),
    ).toHaveLength(1);
  });
});

describe('keepsProduct', () => {
  it('always keeps issues', () => {
    expect(keepsProduct(['issues'], 'issues')).toBe(true);
  });

  it('turns agents off with performance', () => {
    expect(keepsProduct(['performance'], 'agents')).toBe(false);
    expect(keepsProduct([], 'agents')).toBe(true);
  });
});
