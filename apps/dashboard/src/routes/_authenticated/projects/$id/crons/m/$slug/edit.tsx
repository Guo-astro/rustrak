import { PageHeader } from '@rustrak/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { monitorQueries } from '@/features/monitor/api/queries';
import { monitorHref } from '@/features/monitor/lib/href';
import { MonitorForm } from '@/features/monitor/ui/components/monitor-form';
import { translator } from '@/shared/i18n/intl';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/crons/m/$slug/edit',
)({
  loader: async ({ context: { queryClient }, params }) => ({
    monitor: await queryClient.query({
      ...monitorQueries.detail(Number.parseInt(params.id, 10), params.slug),
      staleTime: 'static',
    }),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: translator('crons')('meta.editTitle', {
          monitor: loaderData?.monitor.name ?? '',
        }),
      },
    ],
  }),
  component: EditMonitorPage,
});

function EditMonitorPage() {
  const t = useTranslations('crons');
  const { id, slug } = Route.useParams();
  const projectId = Number.parseInt(id, 10);
  const { data: monitor } = useSuspenseQuery(
    monitorQueries.detail(projectId, slug),
  );
  usePageTrail([
    { label: monitor.name, href: monitorHref(projectId, monitor.slug) },
    { label: t('actions.edit') },
  ]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('form.editTitle', { monitor: monitor.name })}
        summary={[t('form.editDescription')]}
      />
      <div className="flex-1 overflow-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl">
          <MonitorForm projectId={projectId} monitor={monitor} />
        </div>
      </div>
    </div>
  );
}
