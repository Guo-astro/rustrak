import { MuteIcon, Text } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTransition } from 'react';
import { useTranslations } from 'use-intl';
import {
  getMonitor,
  getMonitorStats,
  listCheckIns,
} from '@/features/monitor/api/queries';
import {
  TIMELINE_PERIODS,
  type TimelinePeriod,
} from '@/features/monitor/lib/timeline';
import { CheckInsTable } from '@/features/monitor/ui/components/check-ins-table';
import { CronSetupGuide } from '@/features/monitor/ui/components/cron-setup-guide';
import { MonitorActions } from '@/features/monitor/ui/components/monitor-actions';
import {
  DurationChart,
  MonitorFacts,
  MonitorFigures,
  MonitorTimeline,
} from '@/features/monitor/ui/components/monitor-detail';
import { MonitorStatus } from '@/features/monitor/ui/components/monitor-status';
import { TimelinePeriodFilter } from '@/features/monitor/ui/components/timeline-period';
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf, searchPage } from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { Panel, RailBlock } from '@/shared/ui/components/panel';
import { ScheduleText } from '@/shared/ui/components/schedule-text';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

const PER_PAGE = 25;
const DEFAULT_PERIOD: TimelinePeriod = '24h';

/**
 * One monitor, laid out as the endpoint and release pages are: what it is
 * and what can be done to it in the header, how its runs went in the reading
 * column -- figures, the strips, durations, every check-in -- and its
 * configuration in the rail.
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/crons/m/$slug/',
)({
  validateSearch: (search: Record<string, unknown>) => ({
    page: searchPage(search.page),
    period: searchOneOf(search.period, TIMELINE_PERIODS),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, period: search.period }),
  loader: ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    return loadAll([
      getProject(projectId),
      getMonitor(projectId, params.slug),
      listCheckIns(projectId, params.slug, {
        page: deps.page ?? 1,
        per_page: PER_PAGE,
      }),
      getMonitorStats(projectId, {
        slug: params.slug,
        period: deps.period ?? DEFAULT_PERIOD,
      }),
    ]);
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.success
          ? translator('crons')('meta.detailTitle', {
              monitor: loaderData.data[1].name,
            })
          : translator('crons')('loadMonitorFailed'),
      },
    ],
  }),
  component: MonitorPage,
});

function MonitorPage() {
  const t = useTranslations('crons');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const [isPending, startTransition] = useTransition();
  const projectId = Number.parseInt(id, 10);
  const period = search.period ?? DEFAULT_PERIOD;
  usePageTrail(loaded.success ? [{ label: loaded.data[1].name }] : []);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('loadMonitorFailed')} />;
  }

  const [project, monitor, checkIns, stats] = loaded.data;
  const waiting = monitor.environments.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="@container shrink-0 border-border-divider border-b px-page-gutter pt-6 pb-5">
        <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between @4xl:gap-8">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h1 className="truncate text-fg text-page-title">
                {monitor.name}
              </h1>
              <MonitorStatus monitor={monitor} />
            </div>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-fg-subtle text-meta">
              <span className="font-mono text-mono-sm">{monitor.slug}</span>
              <span aria-hidden="true">·</span>
              <span className="text-fg-secondary">
                <ScheduleText
                  schedule={monitor.config.schedule}
                  timezone={monitor.config.timezone}
                />
              </span>
              {monitor.config.schedule.type === 'crontab' ? (
                <span className="font-mono text-mono-sm">
                  {monitor.config.schedule.value}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {waiting ? null : (
              <TimelinePeriodFilter
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
            )}
            <MonitorActions projectId={projectId} monitor={monitor} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="flex flex-col gap-5 px-page-gutter pt-5 pb-8">
            {monitor.is_muted ? (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-fg-secondary text-meta">
                <MuteIcon size="sm" className="shrink-0" aria-hidden="true" />
                {t('detail.mutedBanner')}
              </p>
            ) : null}

            {waiting ? (
              <Panel
                title={t('detail.waitingTitle')}
                hint={t('detail.waitingDescription')}
              >
                <CronSetupGuide dsn={project.dsn} slug={monitor.slug} />
              </Panel>
            ) : (
              <>
                <MonitorFigures monitor={monitor} stats={stats} />
                <Panel
                  title={t('detail.timeline')}
                  hint={t('detail.timelineHint')}
                >
                  <MonitorTimeline monitor={monitor} stats={stats} />
                </Panel>
                <Panel
                  title={t('detail.duration')}
                  hint={t('detail.durationHint')}
                >
                  <DurationChart stats={stats} />
                </Panel>
              </>
            )}

            <Panel
              flush
              title={t('detail.checkIns')}
              hint={t('detail.checkInsHint')}
            >
              <CheckInsTable
                page={checkIns}
                currentPage={search.page ?? 1}
                showEnvironment={monitor.environments.length > 1}
                pending={isPending}
                onPageChange={(next) =>
                  startTransition(() =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        page: next === 1 ? undefined : next,
                      }),
                    }),
                  )
                }
              />
            </Panel>

            {waiting ? null : (
              <Panel
                title={t('detail.instrument')}
                hint={t('detail.instrumentHint')}
              >
                <CronSetupGuide dsn={project.dsn} slug={monitor.slug} />
              </Panel>
            )}
          </div>
        </main>
        <aside className="border-border-divider bg-panel max-lg:border-t lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l xl:w-88">
          <RailBlock title={t('detail.config')}>
            <MonitorFacts monitor={monitor} />
          </RailBlock>
          <RailBlock title={t('detail.environments')}>
            {waiting ? (
              <Text variant="meta" tone="subtle">
                {t('health.waiting')}
              </Text>
            ) : (
              <ul className="flex flex-col gap-2 text-meta">
                {monitor.environments.map((env) => (
                  <li
                    key={env.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="font-mono text-fg-secondary text-mono-sm">
                      {env.environment}
                    </span>
                    <span
                      className={
                        env.status === 'error'
                          ? 'text-sev-error-fg'
                          : 'text-fg-subtle'
                      }
                    >
                      {t(`environmentStatus.${env.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}
