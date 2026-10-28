import { describe, expect, it } from 'vitest';
import {
  feedbackSender,
  isWebUrl,
  landingAfter,
  nextAfter,
  shortUrl,
} from './feedback-mailbox';

describe('landingAfter', () => {
  it('stays on the page and opens the neighbour', () => {
    expect(landingAfter(['a', 'b'], 'a', 2)).toEqual({
      page: 2,
      selected: 'b',
    });
  });

  it('goes back a page when the last row on it leaves', () => {
    expect(landingAfter(['a'], 'a', 3)).toEqual({
      page: 2,
      selected: undefined,
    });
  });

  it('stays on the first page when it empties', () => {
    expect(landingAfter(['a'], 'a', 1)).toEqual({
      page: 1,
      selected: undefined,
    });
  });
});

describe('isWebUrl', () => {
  it('accepts http and https only', () => {
    expect(isWebUrl('https://shop.io/cart')).toBe(true);
    expect(isWebUrl('HTTP://shop.io')).toBe(true);
    expect(isWebUrl('mailto:a@x.io')).toBe(false);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('/relative')).toBe(false);
  });
});

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
