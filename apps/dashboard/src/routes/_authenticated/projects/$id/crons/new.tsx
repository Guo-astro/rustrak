import { PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { MonitorForm } from '@/features/monitor/ui/components/monitor-form';
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute('/_authenticated/projects/$id/crons/new')({
  loader: async ({ params }) => ({
    project: await getProject(Number.parseInt(params.id, 10)),
  }),
  head: ({ loaderData }) => {
    if (!loaderData?.project.success) {
      return {
        meta: [{ title: translator('projectPages')('projectNotFound') }],
      };
    }
    return {
      meta: [
        {
          title: translator('crons')('meta.newTitle', {
            project: loaderData.project.data.name,
          }),
        },
      ],
    };
  },
  component: NewMonitorPage,
});

function NewMonitorPage() {
  const t = useTranslations('crons');
  const pageT = useTranslations('projectPages');
  const { id } = Route.useParams();
  const { project } = Route.useLoaderData();
  const projectId = Number.parseInt(id, 10);
  usePageTrail([{ label: t('form.newTitle') }]);

  if (!project.success) {
    return (
      <LoadFailure error={project.error} title={pageT('loadProjectFailed')} />
    );
  }

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
