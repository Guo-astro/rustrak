import { PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getMonitor } from '@/features/monitor/api/queries';
import { monitorHref } from '@/features/monitor/lib/href';
import { MonitorForm } from '@/features/monitor/ui/components/monitor-form';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/crons/m/$slug/edit',
)({
  loader: async ({ params }) => ({
    monitor: await getMonitor(Number.parseInt(params.id, 10), params.slug),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.monitor.success
          ? translator('crons')('meta.editTitle', {
              monitor: loaderData.monitor.data.name,
            })
          : translator('crons')('loadMonitorFailed'),
      },
    ],
  }),
  component: EditMonitorPage,
});

function EditMonitorPage() {
  const t = useTranslations('crons');
  const { id } = Route.useParams();
  const { monitor } = Route.useLoaderData();
  const projectId = Number.parseInt(id, 10);
  usePageTrail(
    monitor.success
      ? [
          {
            label: monitor.data.name,
            href: monitorHref(projectId, monitor.data.slug),
          },
          { label: t('actions.edit') },
        ]
      : [],
  );

  if (!monitor.success) {
    return <LoadFailure error={monitor.error} title={t('loadMonitorFailed')} />;
  }
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('form.editTitle', { monitor: monitor.data.name })}
        summary={[t('form.editDescription')]}
      />
      <div className="flex-1 overflow-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl">
          <MonitorForm projectId={projectId} monitor={monitor.data} />
        </div>
      </div>
    </div>
  );
}
