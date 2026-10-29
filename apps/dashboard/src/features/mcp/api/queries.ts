import type { AuthorizationRequest } from '@rustrak/client';
import { queryOptions } from '@tanstack/react-query';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

export const mcpQueries = {
  all: () => ['mcp'] as const,
  /** Whether the server answers MCP clients at `/mcp`. */
  settings: () =>
    queryOptions({
      queryKey: [...mcpQueries.all(), 'settings'],
      queryFn: ({ signal }) => orThrow(api().settings.getMcp({ signal })),
    }),
  /** Verifies an assistant's authorization request and says who is asking. */
  authorization: (request: AuthorizationRequest) =>
    queryOptions({
      queryKey: [...mcpQueries.all(), 'authorization', request],
      queryFn: ({ signal }) =>
        orThrow(api().oauth.getAuthorization({ query: request, signal })),
    }),
  /** The assistants connected to the signed-in user's account. */
  connections: () =>
    queryOptions({
      queryKey: [...mcpQueries.all(), 'connections'],
      queryFn: ({ signal }) => orThrow(api().oauth.listGrants({ signal })),
    }),
};
