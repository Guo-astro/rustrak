import { Page, PageHeader, Text } from '@rustrak/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformIcon } from 'platformicons';
import { useFormatter, useTranslations } from 'use-intl';
import { projectQueries } from '@/features/project/api/queries';
import {
  DEFAULT_PERIOD,
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { OverviewFilters } from './-components/overview-filters';
import {
  ErrorVolumePanel,
  type OverviewFilters as Filters,
  IssuesPanel,
  KpiRow,
  LatencyPanel,
  overviewReads,
  SessionsPanel,
} from './-components/overview-panels';

interface OverviewSearch {
  period?: PeriodChoice;
  environment?: string;
  release?: string;
  compare?: true;
}

/** The URL's filters, as the panels read them. */
function overviewFilters(projectId: number, search: OverviewSearch) {
  const choice = search.period ?? DEFAULT_PERIOD;
  const period = choice === 'all' ? undefined : choice;
  const filters: Filters = {
    projectId,
    period,
    environment: search.environment,
    release: search.release,
  };
  // Nothing comes before all time, so there is nothing to compare it with.
  const compare = !!search.compare && period !== undefined;
  return { choice, filters, compare };
}

export const Route = createFileRoute('/_authenticated/projects/$id/')({
  validateSearch: (search: Record<string, unknown>): OverviewSearch => ({
    // An unrecognized value is dropped rather than passed on: the API ignores
    // what it cannot parse and answers unfiltered, while no control reads as
    // selected. So the URL and the screen always agree.
    period: searchOneOf(search.period, PERIOD_CHOICES),
    environment: searchString(search.environment),
    release: searchString(search.release),
    compare: search.compare === true || search.compare === 'true' || undefined,
  }),
  loaderDeps: ({ search }) => search,
  // Only the project is awaited; every panel is started and fills in when its
  // own read lands, failing on its own.
  loader: ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const { filters, compare } = overviewFilters(projectId, deps);
    const reads = overviewReads(filters, compare);
    void queryClient.prefetchQuery(reads.summary);
    void queryClient.prefetchQuery(reads.events);
    void queryClient.prefetchQuery(reads.sessionSummary);
    void queryClient.prefetchQuery(reads.sessionTrend);
    void queryClient.prefetchQuery(reads.latency);
    void queryClient.prefetchQuery(reads.environments);
    void queryClient.prefetchQuery(reads.releases);
    if (reads.previousEvents)
      void queryClient.prefetchQuery(reads.previousEvents);
    void queryClient.prefetchQuery(reads.issues('recent'));
    return queryClient.query({
      ...projectQueries.detail(projectId),
      staleTime: 'static',
    });
  },
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData) {
      return { meta: [{ title: t('projectNotFound') }] };
    }

    return {
      meta: [
        { title: t('projectTitle', { project: loaderData.name }) },
        {
          name: 'description',
          content: t('overview.meta.description', {
            project: loaderData.name,
          }),
        },
      ],
    };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const t = useTranslations('projectPages');
  const format = useFormatter();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectId = Number.parseInt(id, 10);
  const { data: project } = useSuspenseQuery(projectQueries.detail(projectId));
  const { choice, filters, compare } = overviewFilters(projectId, search);
  const reads = overviewReads(filters, compare);

  return (
    // On a phone the header scrolls away with the page: held in place, the
    // title and the filters would take a third of the screen.
    <div className="flex h-full flex-col max-lg:overflow-y-auto">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <PlatformIcon
              platform={project.platform ?? 'other'}
              size={26}
              format="lg"
              className="shrink-0 rounded-md"
            />
            <span className="truncate">{project.name}</span>
          </span>
        }
        summary={[
          <Text key="slug" variant="mono-sm" tone="meta">
            {project.slug}
          </Text>,
          t('overview.storedEvents', {
            count: format.number(project.stored_event_count, 'compact'),
          }),
        ]}
        actions={
          <OverviewFilters
            projectId={projectId}
            period={choice}
            environment={search.environment}
            release={search.release}
            onChange={(change) =>
              navigate({ search: (prev) => ({ ...prev, ...change }) })
            }
          />
        }
      />

      <Page className="max-lg:flex-none max-lg:overflow-visible">
        <KpiRow reads={reads} filters={filters} />

        {/* min-w-0 on every cell holding a chart: a grid item defaults to
            min-width:auto, so a chart's measured width can pin its column
            open and the page ends up scrolling sideways on a phone. */}
        <ErrorVolumePanel
          reads={reads}
          filters={filters}
          compare={compare}
          onCompareChange={(next) =>
            navigate({
              search: (prev) => ({ ...prev, compare: next || undefined }),
            })
          }
        />

        <div className="grid gap-4 xl:grid-cols-5">
          <div className="min-w-0 xl:col-span-3">
            <IssuesPanel reads={reads} projectId={projectId} />
          </div>
          <div className="min-w-0 xl:col-span-2">
            <SessionsPanel reads={reads} filters={filters} />
          </div>
        </div>

        <LatencyPanel reads={reads} projectId={projectId} />
      </Page>
    </div>
  );
}
