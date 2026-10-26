import type {
  IssueResponse,
  MetricDelta,
  Result,
  RustrakError,
  SessionSummary,
  SessionsGetTimeseriesResponse,
  StatsGetEventTimeseriesResponse,
} from '@rustrak/client';
import {
  BarsChart,
  Button,
  CompareIcon,
  cn,
  SegmentedControl,
  SegmentedItem,
  Sparkline,
  TimeSeriesChart,
} from '@rustrak/ui';
import { type ReactNode, useState } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { listIssues } from '@/features/issue/api/queries';
import {
  getProjectEventTimeseries,
  getProjectStatsSummary,
} from '@/features/project/api/queries';
import {
  periodHours,
  withPreviousPeriod,
} from '@/features/project/lib/overview-series';
import {
  getSessionSummary,
  getSessionTimeseries,
} from '@/features/release/api/queries';
import {
  type OverviewPeriod,
  overviewInterval,
} from '@/features/release/model/session-health';
import { getTransactionStats } from '@/features/transaction/api/queries';
import { loadAll } from '@/shared/lib/results';
import { Link } from '@/shared/ui/components/link';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { MetricDeltaText } from '@/shared/ui/components/metric-delta';
import { TransactionP95Bars } from '@/shared/ui/components/transaction-p95-bars';
import { type Async, useAsync } from '@/shared/ui/hooks/use-async';

/*
 * The overview's panels. Each one renders its own placeholder and its own
 * failure, so the page fills in as each read lands rather than at the speed
 * of the slowest. Reads two panels share -- the event series feeds the error
 * KPI's sparkline and the volume chart -- are made once, in
 * `useOverviewData`, and handed to both.
 */

export interface OverviewFilters {
  projectId: number;
  /** Undefined is all time. */
  period?: OverviewPeriod;
  environment?: string;
  release?: string;
}

type Read<T> = Async<Result<T, RustrakError>>;

type EventPoint = StatsGetEventTimeseriesResponse[number] & {
  previous?: number;
};

export interface OverviewData {
  events: Read<EventPoint[]>;
  summary: ReturnType<typeof useSummary>;
  sessions: Read<[SessionSummary, SessionsGetTimeseriesResponse]>;
}

function useSummary({
  projectId,
  period,
  environment,
  release,
}: OverviewFilters) {
  return useAsync(
    () => getProjectStatsSummary(projectId, period, { environment, release }),
    [projectId, period, environment, release],
  );
}

/** The reads more than one panel needs, made once for the page. */
export function useOverviewData(
  filters: OverviewFilters,
  compare: boolean,
): OverviewData {
  const { projectId, period, environment, release } = filters;
  const scope = { environment, release };
  const interval = overviewInterval(period);

  const events = useAsync(async () => {
    // Comparing asks for twice the window in one request and splits it.
    const window = compare && period ? `${periodHours(period) * 2}h` : period;
    const result = await getProjectEventTimeseries(
      projectId,
      window,
      interval,
      scope,
    );
    if (!result.success || !compare) return result;
    return { ...result, data: withPreviousPeriod(result.data) };
  }, [projectId, period, environment, release, compare]);

  const summary = useSummary(filters);

  const sessions = useAsync(
    () =>
      loadAll([
        getSessionSummary(projectId, period, scope),
        getSessionTimeseries(projectId, period, interval, scope),
      ]),
    [projectId, period, environment, release],
  );

  return { events, summary, sessions };
}

// ── chrome ───────────────────────────────────────────────────────────────────

/** A panel of the overview: a heading, what it covers, and its content. */
function Panel({
  title,
  description,
  actions,
  footer,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-card-title text-fg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-meta text-fg-subtle">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      <div className="min-w-0 flex-1 px-5 pt-4 pb-5">{children}</div>
      {footer ? (
        <footer className="border-t border-border-divider px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

function Placeholder({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-surface-hover motion-reduce:animate-none"
      style={{ height }}
    />
  );
}

/**
 * Renders the read's data, its placeholder, or its failure. A panel that fell
 * back to an empty series would draw a flat line at zero, which reads as
 * "nothing is breaking" -- the most dangerous thing this page could say
 * while wrong.
 */
function Loaded<T>({
  read,
  height,
  title,
  children,
}: {
  read: Read<T>;
  height: number;
  title: string;
  children: (data: T) => ReactNode;
}) {
  if (read.state === 'pending') return <Placeholder height={height} />;
  if (!read.data.success) {
    return (
      <LoadFailure
        error={read.data.error}
        title={title}
        notFoundOnMissing={false}
      />
    );
  }
  return children(read.data.data);
}

/** Bucket labels that say as much as the bucket width can tell. */
function useBucketLabel(intervalHours: number) {
  const format = useFormatter();
  return (value: string | number) =>
    format.dateTime(
      new Date(value),
      intervalHours >= 24
        ? { month: 'short', day: 'numeric' }
        : intervalHours > 1
          ? { month: 'short', day: 'numeric', hour: 'numeric' }
          : { hour: 'numeric', minute: '2-digit' },
    );
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

/** One headline figure, how it moved, and its shape over the window. */
function Kpi({
  label,
  value,
  delta,
  footnote,
  trend,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  footnote?: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border-subtle bg-surface px-4 pt-3.5 pb-4 sm:px-5 sm:pt-4 sm:pb-4.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-meta text-fg-meta">{label}</span>
        {delta}
      </div>
      <div className="flex items-end justify-between gap-4">
        <span className="text-page-title text-fg tabular-nums">{value}</span>
        {trend}
      </div>
      {/* A line is kept even when empty, so the cards in a row line up. */}
      <p className="truncate text-hint text-fg-subtle">
        {footnote ?? '\u00a0'}
      </p>
    </div>
  );
}

/** The change against the previous window; nothing over all time. */
function Delta({ metric }: { metric: MetricDelta }) {
  if (metric.previous === null) return null;
  return <MetricDeltaText metric={metric} polarity="up-is-bad" />;
}

function KpiPlaceholder() {
  return (
    <div className="h-[7.25rem] animate-pulse rounded-2xl border border-border-subtle bg-surface motion-reduce:animate-none" />
  );
}

export function KpiRow({
  data,
  filters,
}: {
  data: OverviewData;
  filters: OverviewFilters;
}) {
  const t = useTranslations('projectPages.overview');
  const format = useFormatter();
  const { summary, events, sessions } = data;
  const percent = (rate: number | null | undefined) =>
    rate == null
      ? '–'
      : format.number(rate, { style: 'percent', maximumFractionDigits: 2 });

  const eventTrend =
    events.state === 'ready' && events.data.success
      ? events.data.data.map((p) => p.total)
      : null;

  const failed = (read: Read<unknown>) =>
    read.state === 'ready' && !read.data.success ? read.data.error : null;
  const failure = failed(summary) ?? failed(sessions);
  if (failure) {
    return (
      <LoadFailure
        error={failure}
        title={t('kpisFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {summary.state === 'ready' && summary.data.success ? (
        <>
          <Kpi
            label={t('errors')}
            value={format.number(summary.data.data.events.current, 'compact')}
            delta={<Delta metric={summary.data.data.events} />}
            footnote={
              [filters.environment, filters.release]
                .filter(Boolean)
                .join(' · ') || null
            }
            trend={
              eventTrend ? (
                <Sparkline
                  values={eventTrend}
                  tone="danger"
                  label={t('errors')}
                  className="hidden h-8 w-28 shrink-0 sm:block"
                />
              ) : null
            }
          />
          <Kpi
            label={t('newIssues')}
            value={format.number(summary.data.data.new_issues.current)}
            delta={<Delta metric={summary.data.data.new_issues} />}
            footnote={t('openIssues', {
              count: format.number(summary.data.data.open_issues),
            })}
          />
        </>
      ) : (
        <>
          <KpiPlaceholder />
          <KpiPlaceholder />
        </>
      )}

      {sessions.state === 'ready' && sessions.data.success ? (
        (() => {
          const [health, series] = sessions.data.data;
          const none = health.total === 0;
          return (
            <>
              <Kpi
                label={t('crashFreeSessions')}
                value={percent(health.crash_free_sessions_rate)}
                footnote={
                  none
                    ? t('noSessions')
                    : t('sessionsCount', {
                        count: format.number(health.total, 'compact'),
                      })
                }
                trend={
                  none ? null : (
                    <Sparkline
                      values={series.map((p) => p.crashed)}
                      tone="danger"
                      label={t('crashes')}
                      className="hidden h-8 w-28 shrink-0 sm:block"
                    />
                  )
                }
              />
              <Kpi
                label={t('crashFreeUsers')}
                value={percent(health.crash_free_users_rate)}
                footnote={
                  none
                    ? t('noSessions')
                    : t('activeReleases', { count: health.active_releases })
                }
              />
            </>
          );
        })()
      ) : (
        <>
          <KpiPlaceholder />
          <KpiPlaceholder />
        </>
      )}
    </div>
  );
}

// ── error volume ─────────────────────────────────────────────────────────────

export function ErrorVolumePanel({
  data,
  filters,
  compare,
  onCompareChange,
}: {
  data: OverviewData;
  filters: OverviewFilters;
  compare: boolean;
  onCompareChange: (compare: boolean) => void;
}) {
  const t = useTranslations('projectPages.overview');
  const format = useFormatter();
  const interval = overviewInterval(filters.period);
  const label = useBucketLabel(interval);
  const read = data.events;
  const total =
    read.state === 'ready' && read.data.success
      ? read.data.data.reduce((sum, p) => sum + p.total, 0)
      : null;

  return (
    <Panel
      title={t('errorVolume')}
      description={
        total === null
          ? ' '
          : t('eventsInWindow', { count: format.number(total) })
      }
      actions={
        // Lives with the chart it changes: it overlays this chart and no
        // other, so in the page header it would read as a page filter.
        <Button
          variant="ghost"
          size="sm"
          icon={CompareIcon}
          selected={compare}
          // All time has no period before it to compare with.
          disabled={!filters.period}
          onClick={() => onCompareChange(!compare)}
        >
          {t('compare')}
        </Button>
      }
    >
      <Loaded read={read} height={280} title={t('errorVolume')}>
        {(points) =>
          compare ? (
            <TimeSeriesChart
              data={points.map((p) => ({
                t: new Date(p.bucket).getTime(),
                total: p.total,
                previous: p.previous ?? 0,
              }))}
              series={[
                {
                  key: 'total',
                  label: t('thisPeriod'),
                  color: 'var(--sev-error)',
                },
                {
                  key: 'previous',
                  label: t('previousPeriod'),
                  color: 'var(--chart-muted)',
                },
              ]}
              xKey="t"
              height={280}
              formatX={label}
              formatY={(v) => format.number(v, 'compact')}
              label={t('errorVolume')}
            />
          ) : (
            <BarsChart
              data={points.map((p) => ({
                t: new Date(p.bucket).getTime(),
                // Fatal reads as an error here; the issue says which.
                error: p.fatal + p.error,
                warning: p.warning,
                info: p.info,
              }))}
              series={[
                {
                  key: 'error',
                  label: t('levelError'),
                  color: 'var(--sev-error)',
                },
                {
                  key: 'warning',
                  label: t('levelWarning'),
                  color: 'var(--sev-warning)',
                },
                {
                  key: 'info',
                  label: t('levelInfo'),
                  color: 'var(--sev-info)',
                },
              ]}
              xKey="t"
              height={280}
              formatX={label}
              formatY={(v) => format.number(v, 'compact')}
              label={t('errorVolume')}
            />
          )
        }
      </Loaded>
    </Panel>
  );
}

// ── issues ───────────────────────────────────────────────────────────────────

const ISSUE_VIEWS = {
  recent: { sort: 'last_seen' },
  new: { sort: 'digest_order' },
  frequent: { sort: 'event_count' },
} as const;

type IssueView = keyof typeof ISSUE_VIEWS;

const LEVEL_MARK: Record<string, string> = {
  fatal: 'bg-sev-error',
  error: 'bg-sev-error',
  warning: 'bg-sev-warning',
};

/**
 * The open issues to look at: the ones firing now, the newest, or the
 * loudest. In an environment, only the issues seen there.
 */
export function IssuesPanel({ filters }: { filters: OverviewFilters }) {
  const t = useTranslations('projectPages.overview');
  const [view, setView] = useState<IssueView>('recent');
  const { projectId, environment, release } = filters;
  const read = useAsync(
    () =>
      listIssues(projectId, {
        filter: 'open',
        page: 1,
        per_page: 6,
        sort: ISSUE_VIEWS[view].sort,
        order: 'desc',
        environment,
        release,
      }),
    [projectId, environment, release, view],
  );

  return (
    <Panel
      title={t('issues')}
      description={t('issuesDescription')}
      actions={
        <SegmentedControl
          aria-label={t('issues')}
          value={view}
          onValueChange={(value) => setView(value as IssueView)}
        >
          <SegmentedItem value="recent">{t('issuesRecent')}</SegmentedItem>
          <SegmentedItem value="new">{t('issuesNew')}</SegmentedItem>
          <SegmentedItem value="frequent">{t('issuesFrequent')}</SegmentedItem>
        </SegmentedControl>
      }
      footer={
        <Link
          href={`/projects/${projectId}/issues`}
          className="text-meta text-fg-subtle hover:text-fg"
        >
          {t('viewAllIssues')}
        </Link>
      }
    >
      <Loaded read={read} height={288} title={t('issues')}>
        {(page) =>
          page.items.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-meta text-fg-subtle">
              {t('noIssuesYet')}
            </p>
          ) : (
            <ul className="-mx-5 -mt-1">
              {page.items.map((issue) => (
                <IssueRow key={issue.id} projectId={projectId} issue={issue} />
              ))}
            </ul>
          )
        }
      </Loaded>
    </Panel>
  );
}

function IssueRow({
  projectId,
  issue,
}: {
  projectId: number;
  issue: IssueResponse;
}) {
  const t = useTranslations('projectPages.overview');
  const format = useFormatter();
  return (
    <li>
      <Link
        href={`/projects/${projectId}/issues/${issue.id}`}
        className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover"
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-8 w-0.75 shrink-0 rounded-pill',
            LEVEL_MARK[issue.level ?? ''] ?? 'bg-sev-info',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-value font-medium text-fg">
            {issue.title}
          </span>
          <span className="truncate text-hint text-fg-subtle">
            <span className="font-mono">{issue.short_id}</span>
            {issue.culprit ? ` · ${issue.culprit}` : null}
          </span>
        </span>
        {issue.trend ? (
          <Sparkline
            values={issue.trend}
            label={t('issueTrend')}
            className="hidden h-6 w-20 shrink-0 sm:block"
          />
        ) : null}
        <span className="flex w-24 shrink-0 flex-col items-end">
          <span className="text-value font-medium text-fg tabular-nums">
            {format.number(issue.event_count, 'compact')}
          </span>
          <span className="truncate text-hint text-fg-meta">
            {format.relativeTime(new Date(issue.last_seen))}
          </span>
        </span>
      </Link>
    </li>
  );
}

// ── sessions ─────────────────────────────────────────────────────────────────

export function SessionsPanel({
  data,
  filters,
}: {
  data: OverviewData;
  filters: OverviewFilters;
}) {
  const t = useTranslations('projectPages.overview');
  const format = useFormatter();
  const label = useBucketLabel(overviewInterval(filters.period));

  return (
    <Panel title={t('sessionHealth')} description={t('sessionHealthSubtitle')}>
      <Loaded read={data.sessions} height={288} title={t('sessionHealth')}>
        {([health, series]) =>
          health.total === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center gap-1.5 text-center">
              <p className="text-value font-medium text-fg">
                {t('noSessions')}
              </p>
              <p className="max-w-xs text-meta text-fg-subtle">
                {t('noSessionsHint')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-3 gap-3">
                <Figure
                  label={t('sessions')}
                  value={format.number(health.total, 'compact')}
                />
                <Figure
                  label={t('errored')}
                  value={format.number(health.errored, 'compact')}
                  tone="text-sev-warning-fg"
                />
                <Figure
                  label={t('crashed')}
                  value={format.number(health.crashed, 'compact')}
                  tone="text-sev-error-fg"
                />
              </dl>
              <TimeSeriesChart
                data={series.map((p) => ({
                  t: new Date(p.bucket).getTime(),
                  rate:
                    p.crash_free_sessions_rate == null
                      ? null
                      : p.crash_free_sessions_rate * 100,
                }))}
                series={[
                  {
                    key: 'rate',
                    label: t('crashFreeSessions'),
                    color: 'var(--chart-3)',
                  },
                ]}
                xKey="t"
                height={208}
                formatX={label}
                formatY={(v) =>
                  format.number(v / 100, {
                    style: 'percent',
                    maximumFractionDigits: 1,
                  })
                }
                label={t('crashFreeSessions')}
              />
            </div>
          )
        }
      </Loaded>
    </Panel>
  );
}

function Figure({
  label,
  value,
  tone = 'text-fg',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-hint text-fg-meta">{label}</dt>
      <dd className={cn('text-section tabular-nums', tone)}>{value}</dd>
    </div>
  );
}

// ── latency ──────────────────────────────────────────────────────────────────

export function LatencyPanel({ projectId }: { projectId: number }) {
  const t = useTranslations('projectPages.overview');

  // Transaction stats have no window of their own yet, so this panel is all
  // time whatever the filters say -- said in its description rather than
  // left to look like it follows them.
  const read = useAsync(
    () => getTransactionStats(projectId, { page: 1, per_page: 20 }),
    [projectId],
  );

  return (
    <Panel title={t('latency')} description={t('latencySubtitle')}>
      <Loaded read={read} height={250} title={t('latency')}>
        {(stats) => (
          <TransactionP95Bars projectId={projectId} rows={stats.items} />
        )}
      </Loaded>
    </Panel>
  );
}
