import type { RustrakError, UserResponse } from '@rustrak/client';
import { Err, Ok } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  clearOnUserChange,
  createQueryClient,
  orThrow,
} from './query';
import { createSessionStore } from './session';

const down: RustrakError = {
  kind: 'network',
  reason: 'timeout',
  message: 'The request timed out.',
};

describe('orThrow', () => {
  it('answers the data of a read that succeeded', async () => {
    expect(await orThrow(Promise.resolve(Ok([1, 2])))).toEqual([1, 2]);
  });

  it('throws the failure as an ApiError that keeps it whole', async () => {
    const thrown = await orThrow(Promise.resolve(Err(down))).catch((e) => e);

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.error).toBe(down);
    expect(thrown.message).toBe('The request timed out.');
  });
});

describe('createQueryClient', () => {
  it('leaves retrying to the API client, which already retries what can succeed', () => {
    const client = createQueryClient();

    expect(client.getDefaultOptions().queries?.retry).toBe(false);
  });

  it('marks stale what a mutation says it changed, once it settles', async () => {
    const client = createQueryClient();
    await client.query({
      queryKey: ['projects', 1, 'issues'],
      queryFn: () => 1,
    });

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => 'done',
        meta: { invalidates: [['projects', 1]] },
      })
      .execute(undefined);

    expect(client.getQueryState(['projects', 1, 'issues'])?.isInvalidated).toBe(
      true,
    );
  });

  it('leaves alone what the mutation did not name', async () => {
    const client = createQueryClient();
    await client.query({
      queryKey: ['projects', 2, 'issues'],
      queryFn: () => 1,
    });

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => 'done',
        meta: { invalidates: [['projects', 1]] },
      })
      .execute(undefined);

    expect(client.getQueryState(['projects', 2, 'issues'])?.isInvalidated).toBe(
      false,
    );
  });
});

describe('clearOnUserChange', () => {
  const user = (id: number) =>
    ({ state: 'authenticated', user: { id } as UserResponse }) as const;

  async function cached() {
    const client = createQueryClient();
    await client.query({ queryKey: ['team'], queryFn: () => ['alice'] });
    return client;
  }

  it('drops what one reader cached when another signs in', async () => {
    const client = await cached();
    const store = createSessionStore(async () => user(1));
    await store.ensure();
    clearOnUserChange(client, store);

    store.set(user(2));

    expect(client.getQueryData(['team'])).toBeUndefined();
  });

  it('drops it on sign-out', async () => {
    const client = await cached();
    const store = createSessionStore(async () => user(1));
    await store.ensure();
    clearOnUserChange(client, store);

    store.clear();

    expect(client.getQueryData(['team'])).toBeUndefined();
  });

  it('keeps it when the same reader is confirmed again', async () => {
    const client = await cached();
    const store = createSessionStore(async () => user(1));
    await store.ensure();
    clearOnUserChange(client, store);

    store.set(user(1));

    expect(client.getQueryData(['team'])).toEqual(['alice']);
  });
});
