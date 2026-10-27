import type { ProjectListStats } from '@rustrak/client';

/**
 * How alarming a project looks at a glance.
 *
 * Ordered by severity, and deliberately not derived from event volume: a
 * single chatty issue can multiply events without anything new being broken,
 * so volume is the wrong thing to colour a project by.
 */
export type ProjectHealth = 'critical' | 'rising' | 'quiet';

export function projectHealth(stats: ProjectListStats): ProjectHealth {
  if (stats.fatal_issues > 0) return 'critical';

  const { current, previous } = stats.new_issues;
  // `previous === null` means an all-time request with nothing to compare
  // against, which is not evidence of a rise. A previous of zero is, though.
  if (previous != null && current > previous) return 'rising';

  return 'quiet';
}
