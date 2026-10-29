import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { getAgentConversation } from '@/features/agent-trace/api/queries';
import { conversationTurns } from '@/features/agent-trace/model/conversation';
import { ConversationTranscript } from '@/features/agent-trace/ui/components/agent-conversations';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

/**
 * One conversation, read as it was had: every turn, oldest first, what was
 * asked, the tools that ran and what came back -- Sentry's conversation
 * view. Each turn links to its trace for the waterfall.
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/agents/conversations/$conversationId',
)({
  loader: ({ params }) =>
    getAgentConversation(Number.parseInt(params.id, 10), params.conversationId),
  head: ({ params }) => ({
    meta: [
      {
        title: translator('agents')('conversations.metaTitle', {
          conversation: params.conversationId,
        }),
      },
    ],
  }),
  component: ConversationPage,
});

function ConversationPage() {
  const t = useTranslations('agents.conversations');
  const format = useFormatter();
  const { id, conversationId } = Route.useParams();
  const loaded = Route.useLoaderData();
  usePageTrail([
    { label: t('title'), href: `/projects/${id}/agents?view=conversations` },
    { label: conversationId, mono: true },
  ]);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('loadFailed')} />;
  }

  const { spans } = loaded.data;
  const turns = conversationTurns(spans);
  const agents = [...new Set(turns.flatMap((turn) => turn.agents))];
  const errors = turns.reduce((sum, turn) => sum + turn.errors, 0);
  const facts: [string, ReactNode][] = [
    [t('turnsLabel'), format.number(turns.length)],
    [
      t('tokensLabel'),
      format.number(turns.reduce((sum, turn) => sum + turn.tokens, 0)),
    ],
    [
      t('errorsLabel'),
      <span className={errors > 0 ? 'text-sev-error-fg' : undefined}>
        {format.number(errors)}
      </span>,
    ],
    [
      t('started'),
      turns[0]?.startedAt
        ? format.dateTime(new Date(turns[0].startedAt), 'precise')
        : '—',
    ],
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-border-divider border-b px-page-gutter pt-6 pb-5">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words text-fg text-page-title">
              {agents.join(' → ') || t('unnamed')}
            </h1>
            <span className="truncate font-mono text-fg-subtle text-mono-sm">
              {conversationId}
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-meta">
            {facts.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="text-fg-subtle">{label}</dt>
                <dd className="text-fg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-page-gutter pt-6 pb-10">
          <ConversationTranscript projectId={Number(id)} spans={spans} />
        </div>
      </div>
    </div>
  );
}
