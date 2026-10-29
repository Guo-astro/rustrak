import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { projectQueries } from '@/features/project/api/queries';
import { ClientKeysSettings } from '@/features/project/ui/components/client-keys-settings';
import { translator } from '@/shared/i18n/intl';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/client-keys',
)({
  head: () => ({
    meta: [{ title: translator('settings')('clientKeys.meta.title') }],
  }),
  component: ClientKeysPage,
});

function ClientKeysPage() {
  const t = useTranslations('settings');
  const { id } = Route.useParams();
  // Cached by the project layout's loader.
  const { data: project } = useSuspenseQuery(
    projectQueries.detail(Number.parseInt(id, 10)),
  );

  return (
    <>
      <SettingsHeader
        title={t('clientKeys.title')}
        description={t('clientKeys.subtitle')}
      />

      <ClientKeysSettings project={project} />
    </>
  );
}
