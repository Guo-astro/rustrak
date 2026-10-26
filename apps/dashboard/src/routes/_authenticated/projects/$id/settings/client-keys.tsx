import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getProject } from '@/features/project/api/queries';
import { ClientKeysSettings } from '@/features/project/ui/components/client-keys-settings';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/client-keys',
)({
  head: () => ({
    meta: [{ title: translator('settings')('clientKeys.meta.title') }],
  }),
  loader: ({ params }) => getProject(Number.parseInt(params.id, 10)),
  component: ClientKeysPage,
});

function ClientKeysPage() {
  const t = useTranslations('settings');
  const project = Route.useLoaderData();

  if (!project.success) {
    return <LoadFailure error={project.error} title={t('loadProjectFailed')} />;
  }

  return (
    <>
      <SettingsHeader
        title={t('clientKeys.title')}
        description={t('clientKeys.subtitle')}
      />

      <ClientKeysSettings project={project.data} />
    </>
  );
}
