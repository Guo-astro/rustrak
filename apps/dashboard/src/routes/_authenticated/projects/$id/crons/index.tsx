import type { MonitorResponse } from '@rustrak/client';
import {
  Button,
  EmptyIcon,
  NewIcon,
  Page,
  PageHeader,
  QueryBar,
  type QueryField,
  Text,
} from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getMonitorStats, listMonitors } from '@/features/monitor/api/queries';
import {
  type MonitorHealth,
  monitorHealth,
} from '@/features/monitor/lib/status';
import {
  TIMELINE_PERIODS,
  type TimelinePeriod,
} from '@/features/monitor/lib/timeline';
import { CronSetupGuide } from '@/features/monitor/ui/components/cron-setup-guide';
import { MonitorList } from '@/features/monitor/ui/components/monitor-list';
import { TimelinePeriodFilter } from '@/features/monitor/ui/components/timeline-period';
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';
import { LoadFailure } from '@/shared/ui/components/load-failure';

const STATES = ['failing', 'ok', 'waiting', 'muted'] as const;
type MonitorState = (typeof STATES)[number];
const DEFAULT_PERIOD: TimelinePeriod = '24h';

/** Failing first, then waiting, then the rest; by name inside each. */
const RANK: Record<MonitorHealth, number> = { failing: 0, waiting: 1, ok: 2 };

function matches(monitor: MonitorResponse, q: string, state?: MonitorState) {
  const text = q.trim().toLowerCase();
  if (
    text &&
    !monitor.name.toLowerCase().includes(text) &&
    !monitor.slug.includes(text)
  ) {
    return false;
  }
  if (!state) return true;
  return state === 'muted'
    ? monitor.is_muted
    : monitorHealth(monitor) === state;
}

/**
 * Crons: every monitor of the project and how its runs went, Sentry's crons
 * overview. A row per monitor, a strip per environment, every strip on one
 * time axis so a shared failure reads straight down the list.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/crons/')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: searchString(search.q),
    state: searchOneOf(search.state, STATES),
    period: searchOneOf(search.period, TIMELINE_PERIODS),
  }),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    return loadAll([
      getProject(projectId),
      listMonitors(projectId),
      getMonitorStats(projectId, { period: deps.period ?? DEFAULT_PERIOD }),
    ]);
  },
  head: ({ loaderData }) => {
    const t = translator('crons');
    if (!loaderData?.success) {
      return {
        meta: [{ title: translator('projectPages')('projectNotFound') }],
      };
    }
    const project = loaderData.data[0].name;
    return {
      meta: [
        { title: t('meta.listTitle', { project }) },
        {
          name: 'description',
          content: t('meta.listDescription', { project }),
        },
      ],
    };
  },
  component: CronsPage,
});

/** A sample slug and schedule for the snippets shown before any monitor exists. */
const SAMPLE_SLUG = 'my-job';
const SAMPLE_SCHEDULE = { type: 'crontab', value: '0 * * * *' } as const;

function CronsPage() {
  const t = useTranslations('crons');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const projectId = Number.parseInt(id, 10);
  const period = search.period ?? DEFAULT_PERIOD;
  const newHref = `/projects/${projectId}/crons/new`;

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('loadFailed')} />;
  }

  const [project, monitors, stats] = loaded.data;
  const failing = monitors.filter((m) => monitorHealth(m) === 'failing').length;
  const shown = monitors
    .filter((m) => matches(m, search.q ?? '', search.state))
    .sort(
      (a, b) =>
        RANK[monitorHealth(a)] - RANK[monitorHealth(b)] ||
        a.name.localeCompare(b.name),
    );

  const fields: QueryField[] = [
    {
      key: 'state',
      label: t('state'),
      variant: 'options',
      multiple: false,
      options: STATES.map((value) => ({
        value,
        label: t(`health.${value}`),
      })),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('title')}
        summary={[
          project.name,
          t('count', { count: monitors.length }),
          failing > 0 ? (
            <span className="text-sev-error-fg">
              {t('failingCount', { count: failing })}
            </span>
          ) : null,
        ]}
        actions={
          monitors.length > 0 ? (
            <Button
              variant="primary"
              icon={NewIcon}
              render={<Link href={newHref} />}
            >
              {t('newMonitor')}
            </Button>
          ) : null
        }
      />

      {monitors.length === 0 ? (
        <Page>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <EmptyIcon size="xl" className="mb-2 text-fg-ghost" />
              <Text variant="body">{t('empty.title')}</Text>
              <Text variant="meta" tone="subtle" className="max-w-xl">
                {t('empty.description')}
              </Text>
            </div>
            <CronSetupGuide
              dsn={project.dsn}
              slug={SAMPLE_SLUG}
              schedule={SAMPLE_SCHEDULE}
            />
            <Text variant="meta" tone="subtle">
              {t('empty.upsertNote')}
            </Text>
            <div className="flex items-center justify-center gap-3 border-border-divider border-t pt-6">
              <Text variant="meta" tone="subtle">
                {t('empty.orManual')}
              </Text>
              <Button size="sm" render={<Link href={newHref} />}>
                {t('empty.manual')}
              </Button>
            </div>
          </div>
        </Page>
      ) : (
        <Page scroll={false}>
          {/* Narrow, the bar takes a row and the window the next. */}
          <div className="flex flex-wrap items-center gap-2">
            <QueryBar
              className="min-w-0 max-sm:basis-full"
              fields={fields}
              filters={
                search.state ? [{ id: 'state', value: [search.state] }] : []
              }
              search={search.q ?? ''}
              placeholder={t('search')}
              onChange={(next) => {
                const state = next.filters.find((f) => f.id === 'state')?.value;
                navigate({
                  search: (prev) => ({
                    ...prev,
                    q: next.search.trim() || undefined,
                    state: Array.isArray(state)
                      ? STATES.find((s) => s === state[0])
                      : undefined,
                  }),
                  replace: true,
                });
              }}
            />
            <TimelinePeriodFilter
              period={period}
              onChange={(next) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    period: next === DEFAULT_PERIOD ? undefined : next,
                  }),
                })
              }
            />
          </div>
          <MonitorList projectId={projectId} monitors={shown} stats={stats} />
        </Page>
      )}
    </div>
  );
}
