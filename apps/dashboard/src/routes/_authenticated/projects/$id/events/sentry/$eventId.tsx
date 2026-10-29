import { createFileRoute, redirect } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { eventQueries } from '@/features/event/api/queries';

/**
 * An event addressed by the id its SDK reported, as a feedback names the
 * error it was about. Redirects to that event inside its issue.
 *
 * In `beforeLoad`, like the issue page, so the redirect happens before
 * anything paints; the component is only for an event with no issue.
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/events/sentry/$eventId',
)({
  beforeLoad: async ({ context: { queryClient }, params }) => {
    const projectId = Number.parseInt(params.id, 10);
    const event = await queryClient.query({
      ...eventQueries.bySentryId(projectId, params.eventId),
      staleTime: 'static',
    });
    if (event.issue_id) {
      throw redirect({
        href: `/projects/${projectId}/issues/${event.issue_id}/events/${event.id}`,
      });
    }
  },
  component: SentryEventPage,
});

function SentryEventPage() {
  const t = useTranslations('projectPages');
  return (
    <p className="p-8 text-sm text-muted-foreground">
      {t('event.feedback.errorNotFound')}
    </p>
  );
}
