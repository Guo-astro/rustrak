import { formatFilterQuery } from '@rustrak/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { ISSUE_FILTER_VARIANTS } from '@/features/issue/model/issue-table';
import { projectQueries } from '@/features/project/api/queries';
import { releaseQueries } from '@/features/release/api/queries';
import {
  DEFAULT_PERIOD,
  overviewInterval,
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';
import { ReleaseFilters } from './-components/release-filters';
import {
  NewIssuesPanel,
  RailBlock,
  ReleaseDetails,
  ReleaseEnvironments,
  ReleaseHeader,
  ReleaseKpis,
  SessionsPanel,
} from './-components/release-panels';

interface ReleaseSearch {
  environment?: string;
  period?: PeriodChoice;
}

/**
 * The page's reads for a URL, built once for the loader and the components so
 * both name the same cache entries.
 *
 * `version` comes already decoded by the router, which treats an undecodable
 * `%zz` as no match: decoding again would turn a literal `%20` into a space.
 */
function releaseReads(
  projectId: number,
  version: string,
  search: ReleaseSearch,
) {
  const choice = search.period ?? DEFAULT_PERIOD;
  const period = choice === 'all' ? undefined : choice;
  const { environment } = search;
  const interval = overviewInterval(period);
  return {
    choice,
    interval,
    release: releaseQueries.detail(projectId, version, {
      environment,
      period,
    }),
    // The project's own health, the average the release is read against.
    project: releaseQueries.sessionSummary(projectId, { period, environment }),
    series: releaseQueries.sessionTimeseries(projectId, {
      period,
      interval,
      environment,
      release: version,
    }),
    newIssues: releaseQueries.newIssues(projectId, version, { limit: 8 }),
    environments: releaseQueries.healthRows(projectId, version, period),
  };
}

export const Route = createFileRoute(
  '/_authenticated/projects/$id/releases/$release',
)({
  validateSearch: (search: Record<string, unknown>): ReleaseSearch => ({
    environment: searchString(search.environment),
    period: searchOneOf(search.period, PERIOD_CHOICES),
  }),
  loaderDeps: ({ search }) => search,
  // The release is awaited; the panels around it are started, each landing
  // on its own.
  loader: async ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const reads = releaseReads(projectId, params.release, deps);
    void queryClient.prefetchQuery(reads.project);
    void queryClient.prefetchQuery(reads.series);
    void queryClient.prefetchQuery(reads.newIssues);
    void queryClient.prefetchQuery(reads.environments);
    // The environment filter's choices.
    void queryClient.prefetchQuery(projectQueries.environments(projectId));
    const [project, release] = await Promise.all([
      queryClient.query({
        ...projectQueries.detail(projectId),
        staleTime: 'static',
      }),
      queryClient.query({ ...reads.release, staleTime: 'static' }),
    ]);
    return { project, release };
  },
  head: ({ loaderData, params }) => {
    const t = translator('projectPages');
    if (!loaderData) {
      return { meta: [{ title: t('projectNotFound') }] };
    }
    const { project, release } = loaderData;
    return {
      meta: [
        {
          title: t('releaseDetail.meta.title', {
            release: release.version,
            project: project.name,
          }),
        },
        {
          name: 'description',
          content: t('releaseDetail.meta.description', {
            release: params.release,
          }),
        },
      ],
    };
  },
  component: ReleaseDetailPage,
});

function ReleaseDetailPage() {
  const t = useTranslations('releases.detail');
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectId = Number.parseInt(params.id, 10);
  const reads = releaseReads(projectId, params.release, search);
  const { choice, interval } = reads;
  const environment = search.environment;
  const { data: release } = useSuspenseQuery(reads.release);
  const project = useQuery(reads.project);
  const series = useQuery(reads.series);
  const newIssues = useQuery(reads.newIssues);
  const environments = useQuery(reads.environments);
  usePageTrail([{ label: release.version, mono: true }]);

  const issuesHref = `/projects/${projectId}/issues?${new URLSearchParams({
    view: 'all',
    q: formatFilterQuery(
      [{ id: 'release', value: [release.version] }],
      '',
      ISSUE_FILTER_VARIANTS,
    ),
  })}`;

  return (
    <div className="flex h-full flex-col">
      <ReleaseHeader
        release={release}
        scope={
          <ReleaseFilters
            projectId={projectId}
            scope={{ environment, period: choice }}
            onChange={(change) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  ...('environment' in change
                    ? { environment: change.environment }
                    : {}),
                  ...(change.period
                    ? {
                        period:
                          change.period === DEFAULT_PERIOD
                            ? undefined
                            : change.period,
                      }
                    : {}),
                }),
                replace: true,
              })
            }
          />
        }
      />

      {/* The issue page's shape: the release's figures and what it broke
          in the reading column, its facts in the rail beside it. */}
      <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="flex flex-col gap-5 px-page-gutter pt-5 pb-8">
            <ReleaseKpis release={release} project={project} />
            <SessionsPanel read={series} intervalHours={interval} />
            <NewIssuesPanel
              projectId={projectId}
              read={newIssues}
              issuesHref={issuesHref}
            />
          </div>
        </main>
        <aside className="border-border-divider bg-panel max-lg:border-t lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l xl:w-88">
          <RailBlock title={t('details')}>
            <ReleaseDetails release={release} />
          </RailBlock>
          <RailBlock title={t('environments')}>
            <ReleaseEnvironments read={environments} />
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}
