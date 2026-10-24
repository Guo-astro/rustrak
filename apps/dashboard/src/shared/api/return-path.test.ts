import { describe, expect, it } from 'vitest';
import { resumablePath } from './return-path';

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
