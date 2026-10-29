/**
 * The first segment of every query key that belongs to one project.
 *
 * Slices cannot import each other, and a project's issues, agents, releases
 * and alerts all need the same prefix: with it, invalidating a project's
 * scope refreshes everything of that project, and deleting one drops it all.
 */
export function projectScope(projectId: number) {
  return ['projects', projectId] as const;
}
