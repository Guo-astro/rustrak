import type { ProjectListStats } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { projectHealth } from './health';

const stats = (overrides: Partial<ProjectListStats>): ProjectListStats => ({
  events: { current: 0, previous: 0 },
  fatal_issues: 0,
  new_issues: { current: 0, previous: 0 },
  open_issues: 0,
  trend: [],
  ...overrides,
});

describe('projectHealth', () => {
  it('is critical with any fatal issue open, whatever else is true', () => {
    expect(
      projectHealth(
        stats({ fatal_issues: 1, new_issues: { current: 0, previous: 9 } }),
      ),
    ).toBe('critical');
  });

  it('is rising when more issues are new than in the window before', () => {
    expect(
      projectHealth(stats({ new_issues: { current: 3, previous: 0 } })),
    ).toBe('rising');
  });

  it('is quiet with nothing to compare against', () => {
    expect(
      projectHealth(stats({ new_issues: { current: 3, previous: null } })),
    ).toBe('quiet');
  });
});
