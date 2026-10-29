import { createFileRoute, redirect } from '@tanstack/react-router';
import { eventQueries } from '@/features/event/api/queries';
import { issueQueries } from '@/features/issue/api/queries';

/**
 * Issue page that redirects to the last event.
 * Viewing an issue immediately shows the most recent event.
 *
 * In `beforeLoad`, so the redirect happens before anything paints. A failed
 * read throws into the error boundary rather than falling through to the
 * empty-state route, because "this issue has no events" is a very different
 * claim from "we could not ask".
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/issues/$issueId/',
)({
  beforeLoad: async ({ context: { queryClient }, params }) => {
    const projectId = Number.parseInt(params.id, 10);
    // The issue too, so a missing one reads as a missing issue, and the event
    // page finds it in the cache.
    const [, lastEvent] = await Promise.all([
      queryClient.query({
        ...issueQueries.detail(projectId, params.issueId),
        staleTime: 'static',
      }),
      // Asked every time: a cached answer would open an older event than
      // the one that just brought the reader here.
      queryClient.query({
        ...eventQueries.latest(projectId, params.issueId),
        staleTime: 0,
      }),
    ]);

    throw redirect({
      href: lastEvent
        ? `/projects/${projectId}/issues/${params.issueId}/events/${lastEvent.id}`
        : `/projects/${projectId}/issues/${params.issueId}/events/empty`,
    });
  },
});
