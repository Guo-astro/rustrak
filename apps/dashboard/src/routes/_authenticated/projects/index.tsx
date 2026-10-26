import type { ProjectsListResponse } from '@rustrak/client';
import { Button, NewIcon, Page, PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useFormatter, useTranslations } from 'use-intl';
import { getProjects } from '@/features/project/api/queries';
import { ProjectsGrid } from '@/features/project/ui/components/projects-grid';
import { translator } from '@/shared/i18n/intl';
import { searchPage } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';
import { LoadFailure } from '@/shared/ui/components/load-failure';

/**
 * Window for the per-row stats.
 *
 * Fixed rather than user-selectable: this page answers "which project should
 * I look at", and `/projects/[id]` already owns choosing a time range.
 */
const STATS_PERIOD = '24h';

export const Route = createFileRoute('/_authenticated/projects/')({
  head: () => {
    const t = translator('projectPages');
    return {
      meta: [
        { title: t('projectsList.meta.title') },
        {
          name: 'description',
          content: t('projectsList.meta.description'),
        },
      ],
    };
  },
  validateSearch: (search: Record<string, unknown>) => ({
    page: searchPage(search.page),
  }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  // One request, stats included: the server aggregates the whole page in two
  // queries. Asking per row would be 20 round trips for a table that renders
  // above the fold.
  loader: ({ deps }) =>
    getProjects({
      page: deps.page,
      per_page: 20,
      stats_period: STATS_PERIOD,
    }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const t = useTranslations('projectPages');
  const tProjects = useTranslations('projects');
  const format = useFormatter();
  const page = Route.useSearch({ select: (search) => search.page ?? 1 });
  const projectsResponse = Route.useLoaderData();

  if (!projectsResponse.success) {
    return (
      <LoadFailure
        error={projectsResponse.error}
        title={t('projectsList.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('projectsList.title')}
        summary={projectsSummary(projectsResponse.data, tProjects, format)}
        actions={
          <Button
            variant="primary"
            icon={NewIcon}
            render={<Link href="/projects/new" />}
          >
            {t('projectsList.newProject')}
          </Button>
        }
      />
      <Page>
        <ProjectsGrid
          initialProjects={projectsResponse.data}
          currentPage={page}
        />
      </Page>
    </div>
  );
}

/**
 * The header's facts: how many projects, how many need looking at, how busy
 * the last day was. The last two add up this page only, which is every
 * project until there are more than fit on one.
 */
function projectsSummary(
  data: ProjectsListResponse,
  tProjects: ReturnType<typeof useTranslations<'projects'>>,
  format: ReturnType<typeof useFormatter>,
): string[] {
  const fatal = data.items.filter((p) => (p.stats?.fatal_issues ?? 0) > 0);
  const events = data.items.reduce(
    (sum, p) => sum + (p.stats?.events.current ?? 0),
    0,
  );

  return [
    tProjects('switcher.count', { count: data.total_count }),
    fatal.length > 0
      ? tProjects('summary.withFatal', { count: fatal.length })
      : '',
    tProjects('summary.events24h', {
      count: format.number(events, 'compact'),
    }),
  ].filter(Boolean);
}
