import { EmptyIcon, Page, PageHeader, Text } from '@rustrak/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { issueQueries } from '@/features/issue/api/queries';
import { translator } from '@/shared/i18n/intl';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/issues/$issueId/events/empty',
)({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.query({
      ...issueQueries.detail(Number.parseInt(params.id, 10), params.issueId),
      staleTime: 'static',
    }),
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData) {
      return { meta: [{ title: t('event.meta.issueNotFound') }] };
    }

    return {
      meta: [{ title: t('event.meta.noEvents', { issue: loaderData.title }) }],
    };
  },
  component: EmptyEventsPage,
});

function EmptyEventsPage() {
  const t = useTranslations('projectPages');
  const { id, issueId } = Route.useParams();
  const { data: issue } = useSuspenseQuery(
    issueQueries.detail(Number.parseInt(id, 10), issueId),
  );
  usePageTrail([{ label: issue.short_id, mono: true }]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={issue.title} />
      <Page>
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <EmptyIcon size="xl" className="mb-2 text-fg-ghost" />
          <Text variant="body">{t('event.noEventsYet')}</Text>
          <Text variant="meta" tone="subtle" className="max-w-md">
            {t('event.noEventsDescription')}
          </Text>
        </div>
      </Page>
    </div>
  );
}
