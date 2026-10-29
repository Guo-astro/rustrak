import type { ProviderType } from '@rustrak/client';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { listIntegrations } from '@/features/alert/api/queries';
import { alertProviders } from '@/features/alert/model/providers';
import {
  type EditParam,
  ProviderSettings,
} from '@/features/alert/ui/components/provider-settings';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';
import { integrationProjectId } from '../-components/integrations-back-link';

export const Route = createFileRoute(
  '/_authenticated/settings/integrations/$provider',
)({
  validateSearch: (search: Record<string, unknown>): { edit?: EditParam } => ({
    edit: search.edit === 'new' ? 'new' : integrationProjectId(search.edit),
  }),
  loader: async ({ params }) => {
    const provider = alertProviders.find((p) => p.type === params.provider);
    if (!provider) throw notFound();
    return { provider, integrations: await listIntegrations() };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.provider.name ?? ''} | Rustrak` }],
  }),
  component: ProviderPage,
});

/** One alert provider: its integrations, and the form to add or edit one. */
function ProviderPage() {
  const t = useTranslations('settings');
  const tAlerts = useTranslations('alerts');
  const { provider, integrations } = Route.useLoaderData();
  usePageTrail([{ label: provider.name }]);
  const { edit } = Route.useSearch();
  const navigate = Route.useNavigate();
  const description = tAlerts(
    provider.descriptionKey as 'providers.slack.description',
  );

  if (!integrations.success) {
    return (
      <>
        <SettingsHeader title={provider.name} description={description} />
        <LoadFailure
          error={integrations.error}
          title={t('integrations.loadFailed')}
          notFoundOnMissing={false}
        />
      </>
    );
  }

  return (
    <ProviderSettings
      provider={provider.type as ProviderType}
      name={provider.name}
      description={description}
      integrations={integrations.data.filter(
        (i) => i.provider_type === provider.type,
      )}
      edit={edit}
      onEdit={(next) => navigate({ search: { edit: next } })}
    />
  );
}
