import type { ConversationSpan, SpanResponse } from '@rustrak/client';
import { chatMessages } from './gen-ai';

/** One turn of a conversation: one trace, read as a chat exchange. */
export interface ConversationTurn {
  traceId: string;
  startedAt: string | null;
  /** Every agent that ran in the turn, in order. */
  agents: string[];
  /** The user's last message in the turn's first model call that holds one. */
  question: string | null;
  /** The last thing a model answered in text. */
  answer: string | null;
  /** The tool calls, in order. */
  tools: ConversationSpan[];
  tokens: number;
  errors: number;
}

const failed = (status: string | null) => status != null && status !== 'ok';

export function conversationHref(projectId: number, conversationId: string) {
  return `/projects/${projectId}/agents/conversations/${encodeURIComponent(conversationId)}`;
}

/**
 * A conversation's spans as turns, a trace each, in the order the server
 * sent them (oldest first): what the user asked, which tools ran, what came
 * back. Agent spans are left out of the token sum: their usage rolls up
 * their children's.
 */
export function conversationTurns(
  spans: ConversationSpan[],
): ConversationTurn[] {
  const turns = new Map<string, ConversationSpan[]>();
  for (const span of spans) {
    turns.set(span.trace_id, [...(turns.get(span.trace_id) ?? []), span]);
  }

  return [...turns.entries()].map(([traceId, inTurn]) => {
    const calls = inTurn.filter((s) => s.operation_type === 'ai_client');
    // The first call may carry only a system prompt: the question is in the
    // first one that says something as the user.
    const question =
      calls
        .map((s) => (s.input ? lastSaid(s.input, 'user') : null))
        .find((said) => said) ?? null;
    const output = calls.filter((s) => s.output).at(-1)?.output;
    return {
      traceId,
      startedAt: inTurn[0]?.start_timestamp ?? null,
      agents: [
        ...new Set(
          inTurn.flatMap((s) =>
            s.operation_type === 'agent' && s.agent_name ? [s.agent_name] : [],
          ),
        ),
      ],
      question,
      answer: output ? lastSaid(output, 'assistant') : null,
      tools: inTurn.filter((s) => s.operation_type === 'tool'),
      tokens: inTurn.reduce(
        (sum, s) =>
          sum + (s.operation_type === 'agent' ? 0 : (s.total_tokens ?? 0)),
        0,
      ),
      errors: inTurn.filter((s) => failed(s.status)).length,
    };
  });
}

/**
 * What `role` last said in a model call's input or output: a message array's
 * last such message, or the text itself when it is no message array -- a
 * plain `ai.prompt`, a `gen_ai.response.text`.
 */
function lastSaid(raw: string, role: string): string | null {
  const messages = chatMessages(raw);
  if (!messages) return raw;
  return messages.filter((m) => m.role === role).at(-1)?.content ?? null;
}

interface Use {
  name: string;
  calls: number;
  errors: number;
}

export interface GraphAgent {
  name: string;
  runs: number;
  /** Failed runs of the agent itself. */
  errors: number;
  models: Use[];
  tools: Use[];
}

export interface AgentGraph {
  /** In the order they first ran. */
  agents: GraphAgent[];
  handoffs: { from: string; to: string; count: number }[];
}

function count(uses: Use[], name: string, error: boolean) {
  const use = uses.find((u) => u.name === name);
  if (use) {
    use.calls += 1;
    use.errors += Number(error);
  } else {
    uses.push({ name, calls: 1, errors: Number(error) });
  }
}

/**
 * The trace as a graph of its agents: each with the models it called and the
 * tools it used, and the handoffs between them. A model or tool call belongs
 * to the agent whose run it sits under, else to the agent it names; a
 * handoff leads from the agent that made it to the next other agent to run.
 */
export function agentGraph(spans: SpanResponse[]): AgentGraph {
  const inOrder = [...spans].sort((a, b) =>
    (a.start_timestamp ?? '').localeCompare(b.start_timestamp ?? ''),
  );
  const bySpanId = new Map(
    inOrder.flatMap((s) => (s.span_id ? [[s.span_id, s] as const] : [])),
  );
  const agents: GraphAgent[] = [];
  const agentOf = (name: string) => {
    let agent = agents.find((a) => a.name === name);
    if (!agent) {
      agent = { name, runs: 0, errors: 0, models: [], tools: [] };
      agents.push(agent);
    }
    return agent;
  };
  const owner = (span: SpanResponse): string | null => {
    // SDKs send the parent links unchecked: a span may be its own parent, or
    // a few may parent each other. A span seen twice ends the walk.
    const seen = new Set<SpanResponse>();
    for (let at: SpanResponse | undefined = span; at && !seen.has(at); ) {
      seen.add(at);
      if (at.gen_ai_operation_type === 'agent' && at.gen_ai_agent_name)
        return at.gen_ai_agent_name;
      at = at.parent_span_id ? bySpanId.get(at.parent_span_id) : undefined;
    }
    return span.gen_ai_agent_name;
  };

  for (const span of inOrder) attribute(span, owner, agentOf);
  return { agents, handoffs: handoffsOf(inOrder) };
}

/** Each handoff, from the agent that made it to the next other agent to run. */
function handoffsOf(inOrder: SpanResponse[]): AgentGraph['handoffs'] {
  const handoffs: AgentGraph['handoffs'] = [];
  for (const span of inOrder) {
    if (span.gen_ai_operation_type !== 'handoff' || !span.gen_ai_agent_name)
      continue;
    const from = span.gen_ai_agent_name;
    const to = inOrder.find(
      (s) =>
        s.gen_ai_operation_type === 'agent' &&
        s.gen_ai_agent_name &&
        s.gen_ai_agent_name !== from &&
        (s.start_timestamp ?? '') >= (span.start_timestamp ?? ''),
    )?.gen_ai_agent_name;
    if (!to) continue;
    const edge = handoffs.find((h) => h.from === from && h.to === to);
    if (edge) edge.count += 1;
    else handoffs.push({ from, to, count: 1 });
  }

  return handoffs;
}

/** Counts one span against its agent: a run, a model call or a tool call. */
function attribute(
  span: SpanResponse,
  owner: (span: SpanResponse) => string | null,
  agentOf: (name: string) => GraphAgent,
) {
  const error = failed(span.status);
  if (span.gen_ai_operation_type === 'agent' && span.gen_ai_agent_name) {
    const agent = agentOf(span.gen_ai_agent_name);
    agent.runs += 1;
    agent.errors += Number(error);
    return;
  }
  const name = owner(span);
  if (!name) return;
  if (span.gen_ai_operation_type === 'ai_client') {
    const model = span.gen_ai_response_model ?? span.gen_ai_request_model;
    if (model) count(agentOf(name).models, model, error);
  } else if (span.gen_ai_operation_type === 'tool' && span.gen_ai_tool_name) {
    count(agentOf(name).tools, span.gen_ai_tool_name, error);
  }
}
