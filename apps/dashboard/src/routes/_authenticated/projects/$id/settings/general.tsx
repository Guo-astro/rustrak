import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getProject } from '@/features/project/api/queries';
import { GeneralSettingsForm } from '@/features/project/ui/components/general-settings-form/general-settings-form';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/general',
)({
  head: () => ({
    meta: [{ title: translator('settings')('general.meta.title') }],
  }),
  loader: ({ params }) => getProject(Number.parseInt(params.id, 10)),
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  const t = useTranslations('settings');
  const project = Route.useLoaderData();

  if (!project.success) {
    return <LoadFailure error={project.error} title={t('loadProjectFailed')} />;
  }

  return (
    <>
      <SettingsHeader
        title={t('general.title')}
        description={t('general.subtitle')}
      />

      <GeneralSettingsForm project={project.data} />
    </>
  );
}
