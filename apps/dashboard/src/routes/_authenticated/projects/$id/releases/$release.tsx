import { formatFilterQuery } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { ISSUE_FILTER_VARIANTS } from '@/features/issue/model/issue-table';
import { getProject } from '@/features/project/api/queries';
import {
  getAllReleaseHealthRows,
  getNewIssuesForRelease,
  getRelease,
  getSessionSummary,
  getSessionTimeseries,
} from '@/features/release/api/queries';
import {
  DEFAULT_PERIOD,
  overviewInterval,
  PERIOD_CHOICES,
} from '@/features/release/model/session-health';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { useAsync } from '@/shared/ui/hooks/use-async';
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

export const Route = createFileRoute(
  '/_authenticated/projects/$id/releases/$release',
)({
  validateSearch: (search: Record<string, unknown>) => ({
    environment: searchString(search.environment),
    period: searchOneOf(search.period, PERIOD_CHOICES),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    // Already decoded by the router, which treats an undecodable `%zz` as
    // no match: decoding again would turn a literal `%20` into a space.
    const version = params.release;
    const period = deps.period ?? DEFAULT_PERIOD;
    return loadAll([
      getProject(projectId),
      getRelease(projectId, version, {
        environment: deps.environment,
        period: period === 'all' ? undefined : period,
      }),
    ]);
  },
  head: ({ loaderData, params }) => {
    const t = translator('projectPages');
    if (!loaderData?.success) {
      return { meta: [{ title: t('projectNotFound') }] };
    }
    const [project, release] = loaderData.data;
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
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const projectId = Number.parseInt(id, 10);
  const choice = search.period ?? DEFAULT_PERIOD;
  const period = choice === 'all' ? undefined : choice;
  const environment = search.environment;
  const version = loaded.success ? loaded.data[1].version : '';
  const interval = overviewInterval(period);

  // The panels around the release, each landing on its own.
  const project = useAsync(
    () => getSessionSummary(projectId, period, { environment }),
    [projectId, period, environment],
  );
  const series = useAsync(
    () =>
      getSessionTimeseries(projectId, period, interval, {
        environment,
        release: version,
      }),
    [projectId, period, environment, version],
  );
  const newIssues = useAsync(
    () => getNewIssuesForRelease(projectId, version, 8),
    [projectId, version],
  );
  const environments = useAsync(
    () => getAllReleaseHealthRows(projectId, version, period),
    [projectId, version, period],
  );

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('loadFailed')} />;
  }

  const [, release] = loaded.data;
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
