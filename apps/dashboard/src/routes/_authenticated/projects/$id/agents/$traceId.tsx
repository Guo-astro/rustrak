import {
  formatSpanDuration,
  SegmentedControl,
  SegmentedItem,
  Waterfall,
} from '@rustrak/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { agentQueries } from '@/features/agent-trace/api/queries';
import { conversationHref } from '@/features/agent-trace/model/conversation';
import {
  resolveSelectedSpan,
  summarizeTrace,
  waterfallSpans,
} from '@/features/agent-trace/model/trace-summary';
import { AgentGraphView } from '@/features/agent-trace/ui/components/agent-graph';
import { SpanDetailPane } from '@/features/agent-trace/ui/components/span-detail-pane';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/agents/$traceId',
)({
  validateSearch: (search: Record<string, unknown>) => ({
    span: searchString(search.span),
    view: searchOneOf(search.view, ['graph'] as const),
  }),
  loaderDeps: ({ search }) => ({ span: search.span }),
  loader: async ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const spans = await queryClient.query({
      ...agentQueries.trace(projectId, params.traceId),
      staleTime: 'static',
    });
    if (spans.length === 0) throw notFound();
    // The pane's span is not awaited: the waterfall can be read without it.
    const { selectedSpanId } = resolveSelectedSpan(spans, deps.span);
    if (selectedSpanId != null) {
      void queryClient.prefetchQuery(
        agentQueries.span(projectId, selectedSpanId),
      );
    }
  },
  head: ({ params }) => {
    const t = translator('projectPages');
    return {
      meta: [{ title: t('trace.meta.title', { traceId: params.traceId }) }],
    };
  },
  component: AgentTraceDetailPage,
});

function AgentTraceDetailPage() {
  const t = useTranslations('projectPages');
  const { id, traceId } = Route.useParams();
  const view = Route.useSearch({ select: (search) => search.view });
  const projectId = Number.parseInt(id, 10);
  const tAgents = useTranslations('agents');
  const format = useFormatter();
  const navigate = Route.useNavigate();
  const spanParam = Route.useSearch({ select: (search) => search.span });
  usePageTrail([{ label: traceId.slice(0, 8), mono: true }]);
  const { data: spans } = useSuspenseQuery(
    agentQueries.trace(projectId, traceId),
  );
  const summary = summarizeTrace(spans);
  const { selectedSpanId, requestedMissing } = resolveSelectedSpan(
    spans,
    spanParam,
  );
  const selected = useQuery({
    ...agentQueries.span(projectId, selectedSpanId ?? ''),
    enabled: selectedSpanId != null,
  });
  const conversation = spans.find(
    (span) => span.gen_ai_conversation_id,
  )?.gen_ai_conversation_id;
  // In the order they ran: a handoff reads left to right.
  const agents = [
    ...new Set(
      [...spans]
        .sort((a, b) =>
          (a.start_timestamp ?? '').localeCompare(b.start_timestamp ?? ''),
        )
        .flatMap((span) =>
          span.gen_ai_agent_name ? [span.gen_ai_agent_name] : [],
        ),
    ),
  ];
  const facts: [string, ReactNode][] = [
    [
      tAgents('columns.duration'),
      summary.duration == null ? '—' : formatSpanDuration(summary.duration),
    ],
    [tAgents('columns.llmCalls'), format.number(summary.llmCallCount)],
    [tAgents('columns.tools'), format.number(summary.toolCallCount)],
    [tAgents('columns.tokens'), format.number(summary.totalTokens)],
    [
      tAgents('columns.errors'),
      <span
        className={summary.errorCount > 0 ? 'text-sev-error-fg' : undefined}
      >
        {format.number(summary.errorCount)}
      </span>,
    ],
    [
      tAgents('columns.started'),
      summary.startedAt == null
        ? '—'
        : format.dateTime(new Date(summary.startedAt), 'precise'),
    ],
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-border-divider border-b px-page-gutter pt-6 pb-5">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words text-fg text-page-title">
              {agents.length ? agents.join(' → ') : t('trace.unnamed')}
            </h1>
            <span className="truncate font-mono text-fg-subtle text-mono-sm">
              {traceId}
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-meta">
            {facts.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="text-fg-subtle">{label}</dt>
                <dd className="text-fg tabular-nums">{value}</dd>
              </div>
            ))}
            {summary.models.length ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-fg-subtle">{tAgents('trace.models')}</dt>
                <dd className="font-mono text-fg text-mono-sm">
                  {summary.models.join(', ')}
                </dd>
              </div>
            ) : null}
            {conversation ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-fg-subtle">
                  {tAgents('trace.conversation')}
                </dt>
                <dd>
                  <Link
                    href={conversationHref(projectId, conversation)}
                    className="font-mono text-fg-secondary text-mono-sm hover:text-fg hover:underline"
                  >
                    {conversation}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      {/* Two panes on a wide screen, stacked on a narrow one. The detail
          scrolls on its own: a long prompt must not push the waterfall out of
          view, since reading them side by side is the point. */}
      <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="px-page-gutter pt-5 pb-8">
            <section className="flex min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface">
              <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-card-title text-fg">
                    {t('trace.spans')}
                  </h2>
                  <span className="text-fg-subtle text-meta">
                    {t('spanCount', { count: spans.length })}
                  </span>
                </div>
                <SegmentedControl
                  aria-label={tAgents('graph.viewLabel')}
                  value={view ?? 'waterfall'}
                  onValueChange={(next) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        view: next === 'graph' ? 'graph' : undefined,
                      }),
                      replace: true,
                      resetScroll: false,
                    })
                  }
                >
                  <SegmentedItem value="waterfall">
                    {tAgents('graph.waterfall')}
                  </SegmentedItem>
                  <SegmentedItem value="graph">
                    {tAgents('graph.graph')}
                  </SegmentedItem>
                </SegmentedControl>
              </header>
              {view === 'graph' ? (
                <AgentGraphView spans={spans} />
              ) : (
                <Waterfall
                  spans={waterfallSpans(spans)}
                  selectedId={selectedSpanId ?? null}
                  onSelect={(span) =>
                    navigate({
                      search: (prev) => ({ ...prev, span: span?.id }),
                      replace: true,
                      resetScroll: false,
                    })
                  }
                  label={tAgents('trace.waterfallOf', { traceId })}
                />
              )}
            </section>
          </div>
        </main>
        <aside className="border-border-divider bg-panel max-lg:border-t lg:w-[30rem] lg:shrink-0 lg:overflow-y-auto lg:border-l xl:w-[34rem]">
          <div className="px-5 py-5">
            <SpanDetailPane
              selected={selectedSpanId == null ? null : selected}
              requestedMissing={requestedMissing}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
