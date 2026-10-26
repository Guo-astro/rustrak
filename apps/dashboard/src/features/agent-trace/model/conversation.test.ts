import type { ConversationSpan, SpanResponse } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { agentGraph, conversationTurns } from './conversation';

function cspan(over: Partial<ConversationSpan>): ConversationSpan {
  return {
    id: crypto.randomUUID(),
    trace_id: 't1',
    span_id: null,
    parent_span_id: null,
    operation_type: 'ai_client',
    agent_name: null,
    model: null,
    tool_name: null,
    status: null,
    start_timestamp: null,
    duration_ms: null,
    total_tokens: null,
    input: null,
    output: null,
    tool_calls: null,
    ...over,
  };
}

describe('conversationTurns', () => {
  it('reads each trace as a turn: what the user asked, the steps, the answer', () => {
    const turns = conversationTurns([
      cspan({ operation_type: 'agent', agent_name: 'support' }),
      cspan({
        input: JSON.stringify([
          { role: 'system', content: 'Be brief.' },
          { role: 'user', content: 'Where is my order?' },
        ]),
        total_tokens: 100,
      }),
      cspan({
        operation_type: 'tool',
        tool_name: 'get_order',
        status: 'internal_error',
        output: 'timeout',
      }),
      cspan({ output: 'It ships tomorrow.', total_tokens: 50 }),
      cspan({ trace_id: 't2', operation_type: 'agent', agent_name: 'billing' }),
      cspan({ trace_id: 't2', output: 'Refund issued.' }),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      traceId: 't1',
      agents: ['support'],
      question: 'Where is my order?',
      answer: 'It ships tomorrow.',
      tokens: 150,
      errors: 1,
    });
    expect(turns[0]?.tools.map((tool) => tool.tool_name)).toEqual([
      'get_order',
    ]);
    expect(turns[1]).toMatchObject({
      question: null,
      answer: 'Refund issued.',
      agents: ['billing'],
    });
  });
});

function span(over: Partial<SpanResponse>): SpanResponse {
  return {
    id: crypto.randomUUID(),
    span_id: null,
    parent_span_id: null,
    gen_ai_operation_type: null,
    gen_ai_agent_name: null,
    gen_ai_request_model: null,
    gen_ai_response_model: null,
    gen_ai_tool_name: null,
    start_timestamp: null,
    status: null,
    ...over,
  } as unknown as SpanResponse;
}

describe('agentGraph', () => {
  it('puts each model and tool call under its agent, and handoffs between agents', () => {
    const graph = agentGraph([
      span({
        span_id: 'a',
        gen_ai_operation_type: 'agent',
        gen_ai_agent_name: 'support',
        start_timestamp: '2026-01-01T00:00:00Z',
      }),
      span({
        parent_span_id: 'a',
        gen_ai_operation_type: 'ai_client',
        gen_ai_request_model: 'gpt-4o',
      }),
      span({
        parent_span_id: 'a',
        gen_ai_operation_type: 'ai_client',
        gen_ai_response_model: 'gpt-4o',
      }),
      span({
        parent_span_id: 'a',
        gen_ai_operation_type: 'tool',
        gen_ai_tool_name: 'search',
        status: 'internal_error',
      }),
      span({
        gen_ai_operation_type: 'handoff',
        gen_ai_agent_name: 'support',
        start_timestamp: '2026-01-01T00:00:05Z',
      }),
      span({
        span_id: 'b',
        gen_ai_operation_type: 'agent',
        gen_ai_agent_name: 'billing',
        start_timestamp: '2026-01-01T00:00:06Z',
      }),
      span({
        parent_span_id: 'b',
        gen_ai_operation_type: 'tool',
        gen_ai_tool_name: 'refund',
      }),
    ]);

    expect(graph.agents).toEqual([
      {
        name: 'support',
        runs: 1,
        errors: 0,
        models: [{ name: 'gpt-4o', calls: 2, errors: 0 }],
        tools: [{ name: 'search', calls: 1, errors: 1 }],
      },
      {
        name: 'billing',
        runs: 1,
        errors: 0,
        models: [],
        tools: [{ name: 'refund', calls: 1, errors: 0 }],
      },
    ]);
    expect(graph.handoffs).toEqual([
      { from: 'support', to: 'billing', count: 1 },
    ]);
  });
});
