import { describe, expect, it } from 'vitest';
import { feedbackSender, nextAfter, shortUrl } from './feedback-mailbox';

describe('nextAfter', () => {
  it('opens the next row', () => {
    expect(nextAfter(['a', 'b', 'c'], 'b')).toBe('c');
  });

  it('opens the one before when the last row leaves', () => {
    expect(nextAfter(['a', 'b', 'c'], 'c')).toBe('b');
  });

  it('opens nothing when the only row leaves, or an unknown one', () => {
    expect(nextAfter(['a'], 'a')).toBeUndefined();
    expect(nextAfter(['a'], 'z')).toBeUndefined();
  });
});

describe('feedbackSender', () => {
  it('prefers the name, then the email', () => {
    expect(feedbackSender({ name: 'Ana', contact_email: 'a@x.io' })).toBe(
      'Ana',
    );
    expect(feedbackSender({ name: '', contact_email: 'a@x.io' })).toBe(
      'a@x.io',
    );
  });
});

describe('shortUrl', () => {
  it('drops the scheme only', () => {
    expect(shortUrl('https://shop.io/cart?x=1')).toBe('shop.io/cart?x=1');
    expect(shortUrl('/relative')).toBe('/relative');
  });
});
