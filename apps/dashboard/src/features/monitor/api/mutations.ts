import type { CreateMonitor, UpdateMonitor } from '@rustrak/client';
import { mutationOptions } from '@tanstack/react-query';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { monitorQueries } from './queries';

/**
 * Every write here changes the list and the stats, and an edit or a delete
 * changes the monitor itself: the slice's whole prefix, each time.
 */
export const monitorMutations = {
  create: (projectId: number) =>
    mutationOptions({
      mutationFn: (body: CreateMonitor) =>
        orThrow(
          api().monitors.create({ path: { project_id: projectId }, body }),
        ),
      meta: { invalidates: [monitorQueries.all(projectId)] },
    }),
  /** The monitor is the variable: the form edits one or creates one. */
  update: (projectId: number) =>
    mutationOptions({
      mutationFn: ({ slug, body }: { slug: string; body: UpdateMonitor }) =>
        orThrow(
          api().monitors.update({
            path: { project_id: projectId, slug },
            body,
          }),
        ),
      meta: { invalidates: [monitorQueries.all(projectId)] },
    }),
  delete: (projectId: number, slug: string) =>
    mutationOptions({
      mutationFn: () =>
        orThrow(
          api().monitors.delete({ path: { project_id: projectId, slug } }),
        ),
      // Dropped before the monitors refetch: asking again for a deleted
      // monitor can only answer 404.
      onSuccess: (_data, _variables, _result, { client }) =>
        client.removeQueries({
          queryKey: monitorQueries.monitor(projectId, slug),
        }),
      meta: { invalidates: [monitorQueries.all(projectId)] },
    }),
};
