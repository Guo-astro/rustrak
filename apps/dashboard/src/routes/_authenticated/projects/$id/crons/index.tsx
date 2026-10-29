import type { MonitorResponse } from '@rustrak/client';
import {
  Button,
  NewIcon,
  Page,
  PageHeader,
  QueryBar,
  type QueryField,
} from '@rustrak/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { monitorQueries } from '@/features/monitor/api/queries';
import {
  type MonitorHealth,
  monitorHealth,
} from '@/features/monitor/lib/status';
import {
  TIMELINE_PERIODS,
  type TimelinePeriod,
} from '@/features/monitor/lib/timeline';
import { CronsEmpty } from '@/features/monitor/ui/components/crons-empty';
import { MonitorList } from '@/features/monitor/ui/components/monitor-list';
import { TimelinePeriodFilter } from '@/features/monitor/ui/components/timeline-period';
import { projectQueries } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';

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
  // The stats are the strips every row is drawn with, so they are the page
  // as much as the list is.
  loader: async ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const [project] = await Promise.all([
      queryClient.query({
        ...projectQueries.detail(projectId),
        staleTime: 'static',
      }),
      queryClient.query({
        ...monitorQueries.list(projectId),
        staleTime: 'static',
      }),
      queryClient.query({
        ...monitorQueries.stats(projectId, {
          period: deps.period ?? DEFAULT_PERIOD,
        }),
        staleTime: 'static',
      }),
    ]);
    return { project };
  },
  head: ({ loaderData }) => {
    const t = translator('crons');
    const project = loaderData?.project.name ?? '';
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

/** How often an empty page asks again, so the first check-in shows itself. */
const EMPTY_POLL_MS = 5_000;

function CronsPage() {
  const t = useTranslations('crons');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectId = Number.parseInt(id, 10);
  const period = search.period ?? DEFAULT_PERIOD;
  const newHref = `/projects/${projectId}/crons/new`;
  const { data: project } = useSuspenseQuery(projectQueries.detail(projectId));
  // The snippet creates the monitor on its first run, so an empty list asks
  // again until one appears and the list replaces the setup screen.
  const { data: monitors } = useSuspenseQuery({
    ...monitorQueries.list(projectId),
    refetchInterval: (query) =>
      query.state.data?.length === 0 ? EMPTY_POLL_MS : false,
  });
  // Asks again with the list, or the monitor the first check-in created
  // would show "waiting" next to the strip that check-in drew.
  const { data: stats } = useSuspenseQuery({
    ...monitorQueries.stats(projectId, { period }),
    refetchInterval: (query) =>
      query.state.data?.length === 0 ? EMPTY_POLL_MS : false,
  });
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
          <CronsEmpty dsn={project.dsn} newHref={newHref} />
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
