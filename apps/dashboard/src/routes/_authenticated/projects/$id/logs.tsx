import type {
  LogResponse,
  LogsVolumeResponse,
  Result,
  RustrakError,
} from '@rustrak/client';
import { cn, EmptyIcon, Page, PageHeader, Text } from '@rustrak/ui';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { useShortcuts } from '@/features/issue/ui/components/issue-actions';
import { getLog, getLogVolume, listLogs } from '@/features/log/api/queries';
import { LOG_LEVELS } from '@/features/log/model/log-view';
import { LogDetail } from '@/features/log/ui/components/log-detail';
import { LogList } from '@/features/log/ui/components/log-list';
import {
  LogSearch,
  type LogSearchValue,
} from '@/features/log/ui/components/log-search';
import { LogVolume } from '@/features/log/ui/components/log-volume';
import { getProject } from '@/features/project/api/queries';
import {
  DEFAULT_PERIOD,
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { PeriodFilter } from '@/features/release/ui/components/period-filter';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import {
  searchOneOf,
  searchPage,
  searchString,
} from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { useAsync } from '@/shared/ui/hooks/use-async';

const PAGE_SIZE = 50;

/**
 * Logs: the lines the SDKs send, newest first.
 *
 * What every log explorer converged on, at the size of this one: a search
 * bar that takes free text for the message and `level:` and `trace:` keys,
 * the window beside it, the volume stacked by level above the lines, and a
 * line opened in a pane beside the list -- j and k to move, Esc to close.
 * Everything is in the URL, so a line can be linked to.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/logs')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: searchString(search.q),
    level: searchOneOf(search.level, LOG_LEVELS),
    trace: searchString(search.trace),
    period: searchOneOf(search.period, PERIOD_CHOICES),
    page: searchPage(search.page),
    selected: searchString(search.selected),
  }),
  loaderDeps: ({ search }) => ({
    q: search.q,
    level: search.level,
    trace: search.trace,
    period: search.period,
    page: search.page,
  }),
  loader: async ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const period = deps.period ?? DEFAULT_PERIOD;
    const filters = {
      query: deps.q,
      level: deps.level,
      trace_id: deps.trace,
      period: period === 'all' ? undefined : period,
    };
    // The chart on its own: a volume that fails leaves the lines readable.
    const [main, volume] = await Promise.all([
      loadAll([
        getProject(projectId),
        listLogs(projectId, {
          ...filters,
          page: deps.page ?? 1,
          per_page: PAGE_SIZE,
        }),
      ]),
      getLogVolume(projectId, filters),
    ]);
    return { main, volume };
  },
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData?.main.success) {
      return { meta: [{ title: t('projectNotFound') }] };
    }

    const [project] = loaderData.main.data;
    return {
      meta: [
        { title: t('logs.meta.title', { project: project.name }) },
        {
          name: 'description',
          content: t('logs.meta.description', { project: project.name }),
        },
      ],
    };
  },
  component: LogsPage,
});

function LogsPage() {
  const t = useTranslations('projectPages');
  const tLogs = useTranslations('logs');
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isPending = useRouterState({ select: (s) => s.status === 'pending' });
  const { id } = Route.useParams();
  const { main: loaded, volume } = Route.useLoaderData();
  const period = search.period ?? DEFAULT_PERIOD;
  const page = search.page ?? 1;

  const items = loaded.success ? loaded.data[1].items : [];
  const selection = useSelectedLog(
    Number.parseInt(id, 10),
    items,
    search.selected,
  );
  const current = selection.log;

  const select = (selected: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, selected }), replace: true });

  // A new search starts over at the newest line, with nothing open.
  const narrow = (next: LogSearchValue & { period?: PeriodChoice }) =>
    navigate({
      search: (prev) => ({
        ...prev,
        ...next,
        page: undefined,
        selected: undefined,
      }),
    });

  const step = (by: number) => {
    const at = current ? items.indexOf(current) + by : 0;
    const next = items[at];
    if (next) select(next.id);
  };

  useShortcuts({
    j: () => step(1),
    k: () => step(-1),
    Escape: () => select(undefined),
  });

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('logs.loadFailed')} />;
  }

  const [project, logs] = loaded.data;
  const filtered = Boolean(search.q || search.level || search.trace);
  const howToSend = t.rich('logs.emptyDescription', {
    code: (chunks) => <code className="font-mono">{chunks}</code>,
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('logs.title')}
        summary={[project.name, tLogs('count', { count: logs.total_count })]}
      />

      {logs.total_count === 0 && !filtered && period === 'all' ? (
        <NoLogsYet title={t('logs.emptyTitle')} hint={howToSend} />
      ) : (
        <Page scroll={false}>
          {/* Narrow, the bar takes a row and the window the next; with a
              line open, the pane takes the whole page. */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-2',
              current && 'max-lg:hidden',
            )}
          >
            <LogSearch
              value={{ q: search.q, level: search.level, trace: search.trace }}
              onChange={narrow}
            />
            <PeriodFilter
              period={period}
              onChange={(next) =>
                narrow({ period: next === DEFAULT_PERIOD ? undefined : next })
              }
            />
          </div>

          <VolumePanel volume={volume} lineOpen={Boolean(current)} />

          <div className="flex min-h-0 flex-1 gap-4">
            {/* Narrow, the pane replaces the list once a line is open. */}
            <div
              className={cn(
                'min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-panel lg:flex',
                current ? 'hidden' : 'flex',
              )}
            >
              <LogList
                logs={logs}
                search={search.q ?? ''}
                selectedId={current?.id}
                // Nothing narrows it, so the window holds no logs: say how to
                // send some, in words that fit "none lately" as well as "none".
                emptyHint={filtered ? undefined : howToSend}
                page={page}
                isPending={isPending}
                onSelect={(id) => select(id === current?.id ? undefined : id)}
                onPageChange={(next) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: next === 1 ? undefined : next,
                      selected: undefined,
                    }),
                  })
                }
              />
            </div>
            <SelectedPane
              selection={selection}
              onTrace={(trace) => narrow({ trace })}
              onClose={() => select(undefined)}
            />
          </div>
        </Page>
      )}
    </div>
  );
}

/** A project that has never sent a log: how to send the first. */
function NoLogsYet({ title, hint }: { title: string; hint: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-page-gutter py-16 text-center">
      <EmptyIcon size="xl" className="mb-2 text-fg-ghost" />
      <Text variant="body">{title}</Text>
      <Text variant="meta" tone="subtle" className="max-w-md">
        {hint}
      </Text>
    </div>
  );
}

/**
 * The volume above the lines, or a line saying it failed: the chart failing
 * never takes the lines with it. On a phone, and beside an open line, the
 * lines need the height more than the chart does.
 */
function VolumePanel({
  volume,
  lineOpen,
}: {
  volume: Result<LogsVolumeResponse, RustrakError>;
  lineOpen: boolean;
}) {
  const tLogs = useTranslations('logs');
  if (volume.success && volume.data.length === 0) return null;
  return (
    <div
      className={cn(
        'shrink-0 rounded-lg border border-border bg-panel px-2 pt-3 pb-1 max-sm:hidden',
        lineOpen && 'max-lg:hidden',
      )}
    >
      {volume.success ? (
        <LogVolume points={volume.data} />
      ) : (
        <Text variant="meta" tone="subtle" className="px-2 pb-2">
          {tLogs('volumeFailed')}
        </Text>
      )}
    </div>
  );
}

/** The open line, or that the one the address names could not be read. */
interface Selection {
  log: LogResponse | undefined;
  failed: boolean;
}

/**
 * The line `?selected=` names: from the page when it is on it, fetched on its
 * own when newer lines have pushed it off, so a linked line still opens.
 */
function useSelectedLog(
  projectId: number,
  items: LogResponse[],
  selected: string | undefined,
): Selection {
  const onPage = items.find((log) => log.id === selected);
  // The answer carries what it was asked for: on the render that changes
  // `selected`, the hook still holds the previous line until its effect runs.
  const asked = `${projectId}:${selected}`;
  const fetched = useAsync(
    async () => ({
      asked,
      result:
        selected && !onPage ? await getLog(projectId, selected) : undefined,
    }),
    [projectId, selected, Boolean(onPage)],
  );
  if (onPage) return { log: onPage, failed: false };
  if (
    fetched.state !== 'ready' ||
    fetched.data.asked !== asked ||
    !fetched.data.result
  ) {
    return { log: undefined, failed: false };
  }
  const { result } = fetched.data;
  return result.success
    ? { log: result.data, failed: false }
    : { log: undefined, failed: true };
}

/** Beside the list: the open line, or why the linked one did not open. */
function SelectedPane({
  selection,
  onTrace,
  onClose,
}: {
  selection: Selection;
  onTrace: (trace: string) => void;
  onClose: () => void;
}) {
  const tLogs = useTranslations('logs');
  if (!selection.log && !selection.failed) return null;
  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden lg:w-[28rem] lg:flex-none lg:rounded-lg lg:border lg:border-border lg:bg-panel xl:w-[34rem]">
      {selection.log ? (
        <LogDetail
          key={selection.log.id}
          log={selection.log}
          onTrace={onTrace}
          onClose={onClose}
        />
      ) : (
        <Text variant="meta" tone="subtle" className="p-4">
          {tLogs('lineFailed')}
        </Text>
      )}
    </div>
  );
}
