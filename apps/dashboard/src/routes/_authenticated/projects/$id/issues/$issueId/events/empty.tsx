import { EmptyIcon, Page, PageHeader, Text } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getIssue } from '@/features/issue/api/queries';
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/issues/$issueId/events/empty',
)({
  loader: ({ params }) => {
    const projectId = Number.parseInt(params.id, 10);
    return loadAll([
      getProject(projectId),
      getIssue(projectId, params.issueId),
    ]);
  },
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData?.success) {
      return { meta: [{ title: t('event.meta.issueNotFound') }] };
    }

    const [, issue] = loaderData.data;
    return {
      meta: [{ title: t('event.meta.noEvents', { issue: issue.title }) }],
    };
  },
  component: EmptyEventsPage,
});

function EmptyEventsPage() {
  const t = useTranslations('projectPages');
  const loaded = Route.useLoaderData();
  usePageTrail(
    loaded.success ? [{ label: loaded.data[1].short_id, mono: true }] : [],
  );

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('loadIssueFailed')} />;
  }

  const [, issue] = loaded.data;

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
