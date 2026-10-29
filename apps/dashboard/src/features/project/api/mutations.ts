/**
 * Writes for the project feature.
 *
 * The rate limits a project update can set are its own, read back through its
 * detail; the server-wide `rateLimits` read never changes from here.
 */
import type { CreateProject, UpdateProject } from '@rustrak/client';
import { mutationOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { projectQueries } from './queries';

export const projectMutations = {
  create: () =>
    mutationOptions({
      mutationFn: (body: CreateProject) =>
        orThrow(api().projects.create({ body })),
      meta: { invalidates: [projectQueries.lists()] },
    }),
  /** Name and platform show in every list and the switcher, not only here. */
  update: (id: number) =>
    mutationOptions({
      mutationFn: (body: UpdateProject) =>
        orThrow(api().projects.update({ path: { id }, body })),
      meta: {
        invalidates: [
          projectQueries.detail(id).queryKey,
          projectQueries.lists(),
        ],
      },
    }),
  delete: (id: number) =>
    mutationOptions({
      mutationFn: () => orThrow(api().projects.delete({ path: { id } })),
      meta: { invalidates: [projectQueries.lists(), projectScope(id)] },
    }),
};
