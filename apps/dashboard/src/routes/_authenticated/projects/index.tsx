import type { ProjectsListResponse } from '@rustrak/client';
import { Button, NewIcon, Page, PageHeader } from '@rustrak/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useFormatter, useTranslations } from 'use-intl';
import { projectQueries } from '@/features/project/api/queries';
import { ProjectsGrid } from '@/features/project/ui/components/projects-grid';
import { translator } from '@/shared/i18n/intl';
import { searchPage } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';

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
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.query({ ...projectsPage(deps.page), staleTime: 'static' }),
  component: ProjectsPage,
});

function projectsPage(page: number) {
  return projectQueries.list({
    page,
    per_page: 20,
    stats_period: STATS_PERIOD,
  });
}

function ProjectsPage() {
  const t = useTranslations('projectPages');
  const tProjects = useTranslations('projects');
  const format = useFormatter();
  const page = Route.useSearch({ select: (search) => search.page ?? 1 });
  const { data: projects } = useSuspenseQuery(projectsPage(page));

  // Deleting the last card on the last page leaves that page empty, and an
  // empty page renders "no projects" with no way back. Send the browser to
  // the last page that exists, as the releases list does.
  if (page > 1 && page > projects.total_pages) {
    return (
      <Navigate
        to="/projects"
        search={{ page: Math.max(projects.total_pages, 1) }}
        replace
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('projectsList.title')}
        summary={projectsSummary(projects, tProjects, format)}
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
        <ProjectsGrid page={projects} currentPage={page} />
      </Page>
    </div>
  );
}

/**
 * The header's facts: how many projects, how many need looking at, how busy
 * the last day was. The last two can only add up the page in hand, so they
 * appear only while that page is every project: beside a total for all of
 * them, a sum over twenty would read as a sum over all.
 */
function projectsSummary(
  data: ProjectsListResponse,
  tProjects: ReturnType<typeof useTranslations<'projects'>>,
  format: ReturnType<typeof useFormatter>,
): string[] {
  const count = tProjects('switcher.count', { count: data.total_count });
  if (data.total_pages > 1) return [count];

  const fatal = data.items.filter((p) => (p.stats?.fatal_issues ?? 0) > 0);
  const events = data.items.reduce(
    (sum, p) => sum + (p.stats?.events.current ?? 0),
    0,
  );

  return [
    count,
    fatal.length > 0
      ? tProjects('summary.withFatal', { count: fatal.length })
      : '',
    tProjects('summary.events24h', {
      count: events,
      display: format.number(events, 'compact'),
    }),
  ].filter(Boolean);
}
