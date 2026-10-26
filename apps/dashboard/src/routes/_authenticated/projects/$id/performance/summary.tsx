import { createFileRoute, notFound } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import {
  DEFAULT_PERIOD,
  PERIOD_CHOICES,
} from '@/features/release/model/session-health';
import { PeriodFilter } from '@/features/release/ui/components/period-filter';
import {
  getEndpointTrend,
  getTransactionStatForGroup,
  listTransactions,
} from '@/features/transaction/api/queries';
import { windowHours } from '@/features/transaction/model/endpoints';
import {
  CallsChart,
  EndpointFacts,
  EndpointFigures,
  LatencyChart,
  Loaded,
  SlowestSamples,
} from '@/features/transaction/ui/components/endpoint-detail';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { Panel, RailBlock } from '@/shared/ui/components/panel';
import { useAsync } from '@/shared/ui/hooks/use-async';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

/**
 * One endpoint, laid out as the release page is: its name and window in the
 * header, how it is doing and how it moved in the reading column, the facts
 * that describe it in the rail. A row of the performance list opens it,
 * keeping the window and environment it was read in.
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/performance/summary',
)({
  validateSearch: (search: Record<string, unknown>) => ({
    name: searchString(search.name),
    op: searchString(search.op),
    period: searchOneOf(search.period, PERIOD_CHOICES),
    environment: searchString(search.environment),
  }),
  // The name *is* the address: without it there is no endpoint to show.
  beforeLoad: ({ search }) => {
    if (!search.name) throw notFound();
  },
  head: ({ match }) => {
    const t = translator('projectPages');
    return {
      meta: [
        {
          title: t('summary.meta.title', {
            name: match.search.name ?? t('summary.meta.fallbackName'),
          }),
        },
      ],
    };
  },
  component: EndpointPage,
});

function EndpointPage() {
  const t = useTranslations('performance.detail');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectId = Number.parseInt(id, 10);
  const period = search.period ?? DEFAULT_PERIOD;
  const name = search.name ?? '';
  const op = search.op ?? null;
  usePageTrail([{ label: name, mono: true }]);
  const scope = {
    period: period === 'all' ? undefined : period,
    environment: search.environment,
  };

  // Three panels, each landing on its own.
  const deps = [projectId, name, op, period, search.environment];
  const stats = useAsync(
    () => getTransactionStatForGroup(projectId, name, op ?? undefined, scope),
    deps,
  );
  const trend = useAsync(
    () => getEndpointTrend(projectId, name, op ?? undefined, scope),
    deps,
  );
  const samples = useAsync(
    () =>
      listTransactions(projectId, {
        name,
        op,
        environment: scope.environment,
        sort: 'slowest',
        per_page: 10,
      }),
    deps,
  );

  return (
    <div className="flex h-full flex-col">
      <header className="@container shrink-0 border-border-divider border-b px-page-gutter pt-6 pb-5">
        <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between @4xl:gap-8">
          <div className="flex min-w-0 flex-col gap-1">
            {op ? <span className="text-fg-meta text-meta">{op}</span> : null}
            <h1 className="break-all font-mono text-fg text-page-title">
              {name}
            </h1>
          </div>
          <PeriodFilter
            period={period}
            onChange={(next) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  period: next === DEFAULT_PERIOD ? undefined : next,
                }),
                replace: true,
              })
            }
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="flex flex-col gap-5 px-page-gutter pt-5 pb-8">
            <Loaded read={stats} height={104} title={t('figures')}>
              {(group) =>
                group ? (
                  <EndpointFigures
                    group={group}
                    windowHours={windowHours(period)}
                  />
                ) : (
                  <p className="text-fg-subtle text-meta">{t('noSamples')}</p>
                )
              }
            </Loaded>
            <Panel title={t('latency')} hint={t('latencyHint')}>
              <Loaded read={trend} height={220} title={t('latency')}>
                {(points) => <LatencyChart points={points} />}
              </Loaded>
            </Panel>
            <Panel title={t('calls')} hint={t('callsHint')}>
              <Loaded read={trend} height={220} title={t('calls')}>
                {(points) => <CallsChart points={points} />}
              </Loaded>
            </Panel>
            <Panel flush title={t('slowest')} hint={t('slowestHint')}>
              <Loaded read={samples} height={240} title={t('slowest')}>
                {(page) => (
                  <SlowestSamples projectId={projectId} rows={page.items} />
                )}
              </Loaded>
            </Panel>
          </div>
        </main>
        <aside className="border-border-divider bg-panel max-lg:border-t lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l xl:w-88">
          <RailBlock title={t('details')}>
            <Loaded read={stats} height={160} title={t('details')}>
              {(group) =>
                group ? (
                  <EndpointFacts
                    group={group}
                    op={op}
                    environment={search.environment}
                  />
                ) : null
              }
            </Loaded>
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}
