import type { ProviderType } from '@rustrak/client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { alertQueries } from '@/features/alert/api/queries';
import { alertProviders } from '@/features/alert/model/providers';
import {
  type EditParam,
  ProviderSettings,
} from '@/features/alert/ui/components/provider-settings';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';
import { integrationProjectId } from '../-components/integrations-back-link';

export const Route = createFileRoute(
  '/_authenticated/settings/integrations/$provider',
)({
  validateSearch: (search: Record<string, unknown>): { edit?: EditParam } => ({
    edit: search.edit === 'new' ? 'new' : integrationProjectId(search.edit),
  }),
  loader: async ({ context: { queryClient }, params }) => {
    const provider = alertProviders.find((p) => p.type === params.provider);
    if (!provider) throw notFound();
    await queryClient.query({
      ...alertQueries.integrations(),
      staleTime: 'static',
    });
    return { provider };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.provider.name ?? ''} | Rustrak` }],
  }),
  component: ProviderPage,
});

/** One alert provider: its integrations, and the form to add or edit one. */
function ProviderPage() {
  const tAlerts = useTranslations('alerts');
  const { provider } = Route.useLoaderData();
  const { data: integrations } = useSuspenseQuery(alertQueries.integrations());
  usePageTrail([{ label: provider.name }]);
  const { edit } = Route.useSearch();
  const navigate = Route.useNavigate();
  const description = tAlerts(
    provider.descriptionKey as 'providers.slack.description',
  );

  return (
    <ProviderSettings
      provider={provider.type as ProviderType}
      name={provider.name}
      description={description}
      integrations={integrations.filter(
        (i) => i.provider_type === provider.type,
      )}
      edit={edit}
      onEdit={(next) => navigate({ search: { edit: next } })}
    />
  );
}
