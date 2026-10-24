import { describe, expect, it } from 'vitest';
import { createReturnPathStore, resumablePath } from './return-path';

/**
 * Where a sign-in returns to.
 *
 * The store gets a storage of its own here rather than a stubbed global:
 * this suite shares one module registry (`isolate: false`), so a stubbed
 * `sessionStorage` would outlive the file.
 */

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

function refused(): never {
  throw new DOMException('The operation is insecure.', 'SecurityError');
}

describe('createReturnPathStore', () => {
  it('returns to the remembered page once', () => {
    const storage = memoryStorage();
    const store = createReturnPathStore(() => storage);

    store.remember('/projects/3/issues?filter=resolved');

    expect(store.take()).toBe('/projects/3/issues?filter=resolved');
    // A later sign-in in the same tab lands on the projects list again.
    expect(store.take()).toBeUndefined();
    expect(storage.items.size).toBe(0);
  });

  it('returns to the last page the reader was sent away from', () => {
    const storage = memoryStorage();
    const store = createReturnPathStore(() => storage);

    store.remember('/projects/3/issues');
    store.remember('/settings/members');

    expect(store.take()).toBe('/settings/members');
  });

  it('drops a stored address it may not follow', () => {
    const storage = memoryStorage();
    const store = createReturnPathStore(() => storage);

    store.remember('//evil.example/projects');

    expect(store.take()).toBeUndefined();
    expect(storage.items.size).toBe(0);
  });

  it('carries on without storage when the browser refuses it', () => {
    const store = createReturnPathStore(refused);

    expect(() => store.remember('/projects/3')).not.toThrow();
    expect(store.take()).toBeUndefined();
  });

  it('carries on when storage refuses the write', () => {
    const storage = { ...memoryStorage(), setItem: refused };
    const store = createReturnPathStore(() => storage);

    expect(() => store.remember('/projects/3')).not.toThrow();
    expect(store.take()).toBeUndefined();
  });
});

describe('resumablePath', () => {
  it('resumes the page a signed-out reader was sent away from', () => {
    for (const path of [
      '/projects/3/issues/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      '/projects/3/issues?query=is%3Aunresolved&page=2',
      '/settings/members',
      '/oauth/authorize?client_id=https%3A%2F%2Fa.example%2Fc.json',
      '/projects/3/events/abc#frame-4',
    ]) {
      expect(resumablePath(path)).toBe(path);
    }
  });

  it('follows nothing that leaves this origin', () => {
    for (const stored of [
      null,
      undefined,
      '',
      'projects/3',
      '//evil.example/projects',
      '/\\evil.example/projects',
      '/\t/evil.example/projects',
      '/.//evil.example/projects',
      '/..//evil.example/projects',
      '/projects/..//evil.example',
      '/%2e//evil.example/projects',
      '/%2E%2E//evil.example/projects',
      'https://evil.example/projects',
      'javascript:alert(document.domain)',
    ]) {
      expect(resumablePath(stored)).toBeUndefined();
    }
  });

  it('returns the address as it was checked', () => {
    expect(resumablePath('/projects/../settings/./members')).toBe(
      '/settings/members',
    );
  });
});
