import { PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { MonitorForm } from '@/features/monitor/ui/components/monitor-form';
import { projectQueries } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute('/_authenticated/projects/$id/crons/new')({
  // Only for the title; the layout has already read it, so this is the cache.
  loader: async ({ context: { queryClient }, params }) => ({
    project: await queryClient.query({
      ...projectQueries.detail(Number.parseInt(params.id, 10)),
      staleTime: 'static',
    }),
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: translator('crons')('meta.newTitle', {
          project: loaderData?.project.name ?? '',
        }),
      },
    ],
  }),
  component: NewMonitorPage,
});

function NewMonitorPage() {
  const t = useTranslations('crons');
  const { id } = Route.useParams();
  const projectId = Number.parseInt(id, 10);
  usePageTrail([{ label: t('form.newTitle') }]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('form.newTitle')}
        summary={[t('form.newDescription')]}
      />
      <div className="flex-1 overflow-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl">
          <MonitorForm projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
