import type { AgentSummary, AgentsTracesData } from '@rustrak/client';
import {
  type DataTableQuery,
  EmptyIcon,
  type FilterVariants,
  Page,
  PageHeader,
  parseTableQuery,
  serializeTableQuery,
  Tab,
  TabList,
  Tabs,
  Text,
} from '@rustrak/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { agentQueries } from '@/features/agent-trace/api/queries';
import {
  AGENT_PERIOD_PARAMS,
  type AgentDashboardFilters,
  agentPeriodParam,
  fillBuckets,
  resolveAgentFilters,
} from '@/features/agent-trace/model/filters';
import { ConversationsList } from '@/features/agent-trace/ui/components/agent-conversations';
import {
  AgentFigures,
  DurationChart,
  ModelsTable,
  RunsChart,
  ToolsTable,
} from '@/features/agent-trace/ui/components/agent-overview';
import { AgentScope } from '@/features/agent-trace/ui/components/agent-scope';
import { AgentTracesTable } from '@/features/agent-trace/ui/components/agent-traces-table';
import { projectQueries } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { Panel } from '@/shared/ui/components/panel';
import { QueryState } from '@/shared/ui/components/query-state';
import { useRouter } from '@/shared/ui/hooks/use-router';

const PAGE_SIZE = 25;
const VIEWS = ['overview', 'traces', 'conversations'] as const;

/** The traces table's keys; free text has no column to search. */
const VARIANTS: FilterVariants = {
  agent: 'text',
  model: 'options',
  tool: 'options',
  status: 'options',
};

type TraceSort = NonNullable<NonNullable<AgentsTracesData['query']>['sort']>;
const SORTS: TraceSort[] = [
  'newest',
  'duration',
  'tokens',
  'llm_calls',
  'tool_calls',
  'errors',
];

interface AgentsSearch {
  view?: (typeof VIEWS)[number];
  /** Absent is the last 24 hours; `all` is all time. */
  period?: (typeof AGENT_PERIOD_PARAMS)[number];
  environment?: string;
  q?: string;
  sort?: string;
  page?: string;
}

function tableQuery(search: AgentsSearch): DataTableQuery {
  const params = new URLSearchParams();
  for (const key of ['q', 'sort', 'page'] as const) {
    const value = search[key];
    if (value) params.set(key, value);
  }
  const query = parseTableQuery(params, VARIANTS, PAGE_SIZE);
  if (query.sorting.length === 0)
    query.sorting = [{ id: 'newest', desc: true }];
  return query;
}

/** One filter's single value, from the table query. */
function filterValue(query: DataTableQuery, id: string): string | undefined {
  const value = query.filters.find((f) => f.id === id)?.value;
  if (Array.isArray(value)) return value[0] ?? undefined;
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * The page's reads for a URL, built once for the loader and the components so
 * both name the same cache entries. One window for every widget: a chart on
 * 24h beside a table on all time is a reader's trap, not a feature.
 */
function agentReads(projectId: number, search: AgentsSearch) {
  const filters = resolveAgentFilters(search);
  const window = {
    period_hours: filters.periodHours,
    environment: filters.environment,
  };
  const series = { ...window, interval_hours: filters.intervalHours };
  const query = tableQuery(search);
  const sort = query.sorting[0]?.id as TraceSort | undefined;
  return {
    filters,
    query,
    summary: agentQueries.summary(projectId, window),
    // Not filtered by the current environment: the picker has to keep
    // offering the option you would switch back to.
    environments: agentQueries.environments(projectId),
    runs: agentQueries.runs(projectId, series),
    duration: agentQueries.duration(projectId, series),
    models: agentQueries.models(projectId, window),
    tools: agentQueries.tools(projectId, window),
    traces: agentQueries.traces(projectId, {
      ...window,
      agent: filterValue(query, 'agent'),
      model: filterValue(query, 'model'),
      tool: filterValue(query, 'tool'),
      errors: filterValue(query, 'status') === 'failing' || undefined,
      sort:
        sort && SORTS.includes(sort) && sort !== 'newest' ? sort : undefined,
      page: query.pagination.pageIndex + 1,
      per_page: PAGE_SIZE,
    }),
    conversations: agentQueries.conversations(projectId, {
      ...window,
      page: Number(search.page ?? 1) || 1,
      per_page: PAGE_SIZE,
    }),
  };
}

/**
 * Agents: Sentry's AI agents insights. The overview answers how the agents
 * are doing -- runs, calls, tokens, latency, failures, by model and by tool
 * -- and the traces tab lists every run, a row a click on a model or tool
 * narrows to the traces that used it.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/agents/')({
  validateSearch: (search: Record<string, unknown>): AgentsSearch => ({
    view: searchOneOf(search.view, VIEWS),
    period: searchOneOf(search.period, AGENT_PERIOD_PARAMS),
    environment: searchString(search.environment),
    q: searchString(search.q),
    sort: searchString(search.sort),
    page: searchString(String(search.page ?? '')) || undefined,
  }),
  loaderDeps: ({ search }) => search,
  // The header and the open tab are awaited; the overview's panels are only
  // started. Awaiting all nine reads made every tab as slow as the slowest,
  // and one that timed out failed the page.
  loader: async ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const reads = agentReads(projectId, deps);
    const view = deps.view ?? 'overview';
    if (view === 'overview') {
      void queryClient.prefetchQuery(reads.runs);
      void queryClient.prefetchQuery(reads.duration);
      void queryClient.prefetchQuery(reads.models);
      void queryClient.prefetchQuery(reads.tools);
    }
    const [project] = await Promise.all([
      queryClient.query({
        ...projectQueries.detail(projectId),
        staleTime: 'static',
      }),
      queryClient.query({ ...reads.summary, staleTime: 'static' }),
      queryClient.query({ ...reads.environments, staleTime: 'static' }),
      // The models and tools are the traces table's filter options.
      view === 'traces' &&
        Promise.all([
          queryClient.query({ ...reads.traces, staleTime: 'static' }),
          queryClient.query({ ...reads.models, staleTime: 'static' }),
          queryClient.query({ ...reads.tools, staleTime: 'static' }),
        ]),
      view === 'conversations' &&
        queryClient.query({ ...reads.conversations, staleTime: 'static' }),
    ]);
    return { project };
  },
  head: ({ loaderData }) => {
    const tPages = translator('projectPages');
    const name = loaderData?.project.name ?? '';
    return {
      meta: [
        { title: tPages('agents.meta.title', { project: name }) },
        {
          name: 'description',
          content: tPages('agents.meta.description', { project: name }),
        },
      ],
    };
  },
  component: AgentsPage,
});

function AgentsPage() {
  const t = useTranslations('agents');
  const tPages = useTranslations('projectPages');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loading = useRouterState({ select: (s) => s.isLoading });
  const projectId = Number.parseInt(id, 10);
  const view = search.view ?? 'overview';
  const reads = agentReads(projectId, search);
  const { filters, query } = reads;
  const { data: project } = useSuspenseQuery(projectQueries.detail(projectId));
  const { data: summary } = useSuspenseQuery(reads.summary);
  const { data: environments } = useSuspenseQuery(reads.environments);

  // A model or tool row opens the traces that used it.
  const openTraces = (key: 'model' | 'tool', value: string) => {
    const next = serializeTableQuery(
      {
        ...query,
        filters: [{ id: key, value: [value] }],
        pagination: { ...query.pagination, pageIndex: 0 },
      },
      VARIANTS,
      PAGE_SIZE,
    );
    navigate({
      search: (prev) => ({
        ...prev,
        view: 'traces',
        q: next.get('q') ?? undefined,
        page: undefined,
      }),
    });
  };

  const scope = (
    <AgentScope
      environments={environments}
      environment={search.environment}
      period={filters.period}
      onChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            environment: next.environment,
            period: agentPeriodParam(next.period),
            page: undefined,
          }),
        })
      }
    />
  );

  const nothingYet = isNothingYet(summary, filters, environments);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={tPages('agents.title')}
        summary={[
          project.name,
          t('runsCount', { count: summary.agent_runs }),
          summary.error_count > 0 ? (
            <span className="text-sev-error-fg">
              {t('errorsCount', { count: summary.error_count })}
            </span>
          ) : null,
        ]}
        tabs={
          nothingYet ? undefined : (
            <Tabs
              value={view}
              onValueChange={(next) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    view:
                      next === 'overview'
                        ? undefined
                        : (next as 'traces' | 'conversations'),
                    page: undefined,
                    q: undefined,
                    sort: undefined,
                  }),
                })
              }
            >
              <TabList>
                <Tab value="overview">{t('tabs.overview')}</Tab>
                <Tab value="traces">{t('tabs.traces')}</Tab>
                <Tab value="conversations">{t('tabs.conversations')}</Tab>
              </TabList>
            </Tabs>
          )
        }
      />

      {nothingYet ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-page-gutter py-16 text-center">
          <EmptyIcon size="xl" className="mb-2 text-fg-ghost" />
          <Text variant="body">{tPages('agents.emptyTitle')}</Text>
          <Text variant="meta" tone="subtle" className="max-w-md">
            {tPages('agents.emptyDescription')}
          </Text>
        </div>
      ) : view === 'conversations' ? (
        <AgentsConversations
          reads={reads}
          loading={loading}
          scope={scope}
          projectId={projectId}
        />
      ) : view === 'traces' ? (
        <AgentsTraces
          reads={reads}
          loading={loading}
          scope={scope}
          projectId={projectId}
        />
      ) : (
        <AgentsOverview
          reads={reads}
          summary={summary}
          scope={scope}
          onOpen={openTraces}
        />
      )}
    </div>
  );
}

/** The overview's panels, each arriving with its own read. */
function AgentsOverview({
  reads,
  summary,
  scope,
  onOpen: openTraces,
}: {
  reads: AgentReads;
  summary: AgentSummary;
  scope: ReactNode;
  onOpen: (key: 'model' | 'tool', value: string) => void;
}) {
  const t = useTranslations('agents');
  const loadFailed = useTranslations('projectPages')('agents.loadFailed');
  const { filters } = reads;
  const runs = useQuery(reads.runs);
  const duration = useQuery(reads.duration);
  const models = useQuery(reads.models);
  const tools = useQuery(reads.tools);
  return (
    <Page>
      <div className="flex justify-end">{scope}</div>
      <AgentFigures summary={summary} />
      <div className="grid shrink-0 gap-5 xl:grid-cols-2">
        <Panel title={t('charts.runs')} hint={t('charts.runsHint')}>
          <QueryState
            query={runs}
            placeholder={<PanelPlaceholder height={200} />}
            title={loadFailed}
          >
            {(points) => (
              <RunsChart
                points={fillBuckets(
                  points,
                  filters.intervalHours,
                  filters.periodHours,
                  (bucket) => ({ bucket, value: 0, errors: 0 }),
                )}
              />
            )}
          </QueryState>
        </Panel>
        <Panel title={t('charts.duration')} hint={t('charts.durationHint')}>
          {/* An empty bucket is a gap in the line, not a zero. */}
          <QueryState
            query={duration}
            placeholder={<PanelPlaceholder height={200} />}
            title={loadFailed}
          >
            {(points) => (
              <DurationChart
                points={fillBuckets(
                  points,
                  filters.intervalHours,
                  filters.periodHours,
                  (bucket) => ({ bucket, avg_ms: 0, p95_ms: 0 }),
                )}
              />
            )}
          </QueryState>
        </Panel>
      </div>
      <div className="grid shrink-0 gap-5 xl:grid-cols-2">
        <Panel
          flush
          title={t('modelsTable.title')}
          hint={t('modelsTable.hint')}
        >
          <QueryState
            query={models}
            placeholder={<PanelPlaceholder height={240} />}
            title={loadFailed}
          >
            {(rows) => (
              <ModelsTable
                rows={rows}
                onOpen={(model) => openTraces('model', model)}
              />
            )}
          </QueryState>
        </Panel>
        <Panel flush title={t('toolsTable.title')} hint={t('toolsTable.hint')}>
          <QueryState
            query={tools}
            placeholder={<PanelPlaceholder height={240} />}
            title={loadFailed}
          >
            {(rows) => (
              <ToolsTable
                rows={rows}
                onOpen={(tool) => openTraces('tool', tool)}
              />
            )}
          </QueryState>
        </Panel>
      </div>
    </Page>
  );
}

/** The traces tab: every run, filtered, sorted and paged through the URL. */
function AgentsTraces({
  reads,
  loading,
  scope,
  projectId,
}: {
  reads: AgentReads;
  loading: boolean;
  scope: ReactNode;
  projectId: number;
}) {
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { query } = reads;
  const { data: page } = useSuspenseQuery(reads.traces);
  const { data: models } = useSuspenseQuery(reads.models);
  const { data: tools } = useSuspenseQuery(reads.tools);
  return (
    <Page scroll={false}>
      <AgentTracesTable
        page={page}
        query={query}
        loading={loading}
        models={models.map((m) => m.model)}
        tools={tools.map((m) => m.tool)}
        scope={scope}
        onOpen={(trace) =>
          router.push(`/projects/${projectId}/agents/${trace.trace_id}`)
        }
        onQueryChange={(updater) => {
          const next = updater(query);
          const params = serializeTableQuery(
            {
              ...next,
              sorting: next.sorting.map((s) => ({ ...s, desc: true })),
            },
            VARIANTS,
            PAGE_SIZE,
          );
          navigate({
            search: (prev) => ({
              ...prev,
              q: params.get('q') ?? undefined,
              sort:
                next.sorting[0]?.id === 'newest'
                  ? undefined
                  : (params.get('sort') ?? undefined),
              page: params.get('page') ?? undefined,
            }),
          });
        }}
      />
    </Page>
  );
}

/** The conversations tab: a page of them, the most recently active first. */
function AgentsConversations({
  reads,
  loading,
  scope,
  projectId,
}: {
  reads: AgentReads;
  loading: boolean;
  scope: ReactNode;
  projectId: number;
}) {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { data: conversations } = useSuspenseQuery(reads.conversations);
  return (
    <Page scroll={false}>
      <div className="flex justify-end">{scope}</div>
      <ConversationsList
        projectId={projectId}
        page={conversations}
        currentPage={Number(search.page ?? 1) || 1}
        loading={loading}
        onPageChange={(next) =>
          navigate({
            search: (prev) => ({
              ...prev,
              page: next === 1 ? undefined : String(next),
            }),
          })
        }
      />
    </Page>
  );
}

/**
 * Whether to show the setup screen. Nothing in the window is not nothing
 * ever: only when no AI span has ever arrived to name an environment, or all
 * time is what came back empty.
 */
function isNothingYet(
  summary: AgentSummary,
  filters: AgentDashboardFilters,
  environments: string[],
): boolean {
  const empty =
    summary.agent_runs + summary.llm_calls + summary.tool_calls === 0;
  return (
    empty &&
    filters.environment === undefined &&
    (filters.period === undefined || environments.length === 0)
  );
}

type AgentReads = ReturnType<typeof agentReads>;

function PanelPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-surface-hover motion-reduce:animate-none"
      style={{ height }}
    />
  );
}
