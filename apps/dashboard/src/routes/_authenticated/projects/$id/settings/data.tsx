import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getProject, getRateLimits } from '@/features/project/api/queries';
import { RateLimitSettings } from '@/features/project/ui/components/general-settings-form/rate-limit-settings';
import { ProductsSettings } from '@/features/project/ui/components/products-settings';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/data',
)({
  head: () => ({
    meta: [{ title: `${translator('settings')('data.title')} | Rustrak` }],
  }),
  loader: async ({ params }) => {
    const [project, rateLimits] = await Promise.all([
      getProject(Number.parseInt(params.id, 10)),
      getRateLimits(),
    ]);
    return { project, rateLimits };
  },
  component: DataSettingsPage,
});

/**
 * The project's control over its ingest: which kinds of data it keeps, and
 * how much of it per minute and hour. Both answer "what lands in this
 * project", so they are one page.
 */
function DataSettingsPage() {
  const t = useTranslations('settings');
  const { project, rateLimits } = Route.useLoaderData();

  if (!project.success) {
    return <LoadFailure error={project.error} title={t('loadProjectFailed')} />;
  }

  return (
    <>
      <SettingsHeader
        title={t('data.title')}
        description={t('data.subtitle')}
      />

      {/* Keyed: its state seeds once, and the next project must not inherit
          this one's switches. */}
      <ProductsSettings key={project.data.id} project={project.data} />

      <RateLimitSettings
        project={project.data}
        // A failure here costs only the placeholder, not the page.
        serverLimits={rateLimits.success ? rateLimits.data : null}
      />
    </>
  );
}
