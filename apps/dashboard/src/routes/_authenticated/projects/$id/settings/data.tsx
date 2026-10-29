import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { projectQueries } from '@/features/project/api/queries';
import { RateLimitSettings } from '@/features/project/ui/components/general-settings-form/rate-limit-settings';
import { ProductsSettings } from '@/features/project/ui/components/products-settings';
import { translator } from '@/shared/i18n/intl';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/data',
)({
  head: () => ({
    meta: [{ title: `${translator('settings')('data.title')} | Rustrak` }],
  }),
  // The project is the layout's; the server's limits are only a placeholder.
  loader: ({ context: { queryClient } }) =>
    void queryClient.prefetchQuery(projectQueries.rateLimits()),
  component: DataSettingsPage,
});

/**
 * The project's control over its ingest: which kinds of data it keeps, and
 * how much of it per minute and hour. Both answer "what lands in this
 * project", so they are one page.
 */
function DataSettingsPage() {
  const t = useTranslations('settings');
  const { id } = Route.useParams();
  const { data: project } = useSuspenseQuery(
    projectQueries.detail(Number.parseInt(id, 10)),
  );
  const rateLimits = useQuery(projectQueries.rateLimits());

  return (
    <>
      <SettingsHeader
        title={t('data.title')}
        description={t('data.subtitle')}
      />

      {/* Keyed: its state seeds once, and the next project must not inherit
          this one's switches. */}
      <ProductsSettings key={project.id} project={project} />

      <RateLimitSettings
        project={project}
        // A failure here costs only the placeholder, not the page.
        serverLimits={rateLimits.data ?? null}
      />
    </>
  );
}
