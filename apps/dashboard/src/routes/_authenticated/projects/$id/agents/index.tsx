import type { AgentsTracesData } from '@rustrak/client';
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
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import {
  getAgentConversations,
  getAgentDuration,
  getAgentEnvironments,
  getAgentModelsTable,
  getAgentRuns,
  getAgentSummary,
  getAgentToolsTable,
  getAgentTraces,
} from '@/features/agent-trace/api/queries';
import {
  AGENT_PERIODS,
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
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { Panel } from '@/shared/ui/components/panel';
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
  period?: (typeof AGENT_PERIODS)[number];
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
 * Agents: Sentry's AI agents insights. The overview answers how the agents
 * are doing -- runs, calls, tokens, latency, failures, by model and by tool
 * -- and the traces tab lists every run, a row a click on a model or tool
 * narrows to the traces that used it.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/agents/')({
  validateSearch: (search: Record<string, unknown>): AgentsSearch => ({
    view: searchOneOf(search.view, VIEWS),
    period: searchOneOf(search.period, AGENT_PERIODS),
    environment: searchString(search.environment),
    q: searchString(search.q),
    sort: searchString(search.sort),
    page: searchString(String(search.page ?? '')) || undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    // One window for every widget on the page: a chart on 24h beside a table
    // on all-time is a reader's trap, not a feature.
    const filters = resolveAgentFilters(deps);
    const window = {
      period_hours: filters.periodHours,
      environment: filters.environment,
    };
    const query = tableQuery(deps);
    const sort = query.sorting[0]?.id as TraceSort | undefined;
    return loadAll([
      getProject(projectId),
      getAgentSummary(projectId, window),
      getAgentRuns(projectId, {
        ...window,
        interval_hours: filters.intervalHours,
      }),
      getAgentDuration(projectId, {
        ...window,
        interval_hours: filters.intervalHours,
      }),
      getAgentModelsTable(projectId, window),
      getAgentToolsTable(projectId, window),
      getAgentTraces(projectId, {
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
      // Not filtered by the current environment: the picker has to keep
      // offering the option you would switch back to.
      getAgentEnvironments(projectId),
      getAgentConversations(projectId, {
        ...window,
        page: deps.view === 'conversations' ? Number(deps.page ?? 1) || 1 : 1,
        per_page: PAGE_SIZE,
      }),
    ]);
  },
  head: ({ loaderData }) => {
    const tPages = translator('projectPages');
    if (!loaderData?.success) {
      return { meta: [{ title: tPages('projectNotFound') }] };
    }
    const [project] = loaderData.data;
    return {
      meta: [
        { title: tPages('agents.meta.title', { project: project.name }) },
        {
          name: 'description',
          content: tPages('agents.meta.description', { project: project.name }),
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
  const router = useRouter();
  const loaded = Route.useLoaderData();
  const loading = useRouterState({ select: (s) => s.isLoading });
  const projectId = Number.parseInt(id, 10);
  const view = search.view ?? 'overview';
  const filters = resolveAgentFilters(search);

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={tPages('agents.loadFailed')} />
    );
  }

  const [
    project,
    summary,
    runs,
    duration,
    models,
    tools,
    traces,
    environments,
    conversations,
  ] = loaded.data;
  const query = tableQuery(search);

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
      period={search.period}
      onChange={(next) =>
        navigate({
          search: (prev) => ({ ...prev, ...next, page: undefined }),
        })
      }
    />
  );

  const nothingYet =
    summary.agent_runs + summary.llm_calls + summary.tool_calls === 0 &&
    !search.period &&
    !search.environment;

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
      ) : view === 'traces' ? (
        <Page scroll={false}>
          <AgentTracesTable
            page={traces}
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
      ) : (
        <Page>
          <div className="flex justify-end">{scope}</div>
          <AgentFigures summary={summary} />
          <div className="grid shrink-0 gap-5 xl:grid-cols-2">
            <Panel title={t('charts.runs')} hint={t('charts.runsHint')}>
              <RunsChart
                points={fillBuckets(
                  runs,
                  filters.intervalHours,
                  filters.periodHours,
                  (bucket) => ({ bucket, value: 0, errors: 0 }),
                )}
              />
            </Panel>
            <Panel title={t('charts.duration')} hint={t('charts.durationHint')}>
              {/* An empty bucket is a gap in the line, not a zero. */}
              <DurationChart
                points={fillBuckets(
                  duration,
                  filters.intervalHours,
                  filters.periodHours,
                  (bucket) => ({ bucket, avg_ms: 0, p95_ms: 0 }),
                )}
              />
            </Panel>
          </div>
          <div className="grid shrink-0 gap-5 xl:grid-cols-2">
            <Panel
              flush
              title={t('modelsTable.title')}
              hint={t('modelsTable.hint')}
            >
              <ModelsTable
                rows={models}
                onOpen={(model) => openTraces('model', model)}
              />
            </Panel>
            <Panel
              flush
              title={t('toolsTable.title')}
              hint={t('toolsTable.hint')}
            >
              <ToolsTable
                rows={tools}
                onOpen={(tool) => openTraces('tool', tool)}
              />
            </Panel>
          </div>
        </Page>
      )}
    </div>
  );
}
