import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { projectQueries } from '@/features/project/api/queries';
import { GeneralSettingsForm } from '@/features/project/ui/components/general-settings-form/general-settings-form';
import { translator } from '@/shared/i18n/intl';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/general',
)({
  head: () => ({
    meta: [{ title: translator('settings')('general.meta.title') }],
  }),
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  const t = useTranslations('settings');
  const { id } = Route.useParams();
  // Cached by the project layout's loader.
  const { data: project } = useSuspenseQuery(
    projectQueries.detail(Number.parseInt(id, 10)),
  );

  return (
    <>
      <SettingsHeader
        title={t('general.title')}
        description={t('general.subtitle')}
      />

      <GeneralSettingsForm project={project} />
    </>
  );
}
