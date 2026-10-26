import { describe, expect, it } from 'vitest';
import { matchParts, volumeBars } from './log-view';

describe('volumeBars', () => {
  it('folds fatal into error and trace into debug', () => {
    expect(
      volumeBars([
        {
          bucket: '2026-10-26T10:00:00Z',
          trace: 1,
          debug: 2,
          info: 3,
          warn: 4,
          error: 5,
          fatal: 6,
        },
      ]),
    ).toEqual([
      {
        t: Date.parse('2026-10-26T10:00:00Z'),
        debug: 3,
        info: 3,
        warn: 4,
        error: 11,
      },
    ]);
  });
});

describe('matchParts', () => {
  it('marks every match, ignoring case', () => {
    expect(matchParts('Payment failed, payment retried', 'PAYMENT')).toEqual([
      { text: 'Payment', match: true },
      { text: ' failed, ', match: false },
      { text: 'payment', match: true },
      { text: ' retried', match: false },
    ]);
  });

  it('takes the query literally and leaves blank queries alone', () => {
    expect(matchParts('a.b axb', '.')).toEqual([
      { text: 'a', match: false },
      { text: '.', match: true },
      { text: 'b axb', match: false },
    ]);
    expect(matchParts('text', '  ')).toEqual([{ text: 'text', match: false }]);
  });
});
