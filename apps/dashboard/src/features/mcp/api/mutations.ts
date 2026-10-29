import type { AuthorizationRequest } from '@rustrak/client';
import { mutationOptions } from '@tanstack/react-query';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { mcpQueries } from './queries';

export const mcpMutations = {
  /** Opens or closes `/mcp`. Instance admins only; anyone else gets a 403. */
  updateSettings: () =>
    mutationOptions({
      mutationFn: (enabled: boolean) =>
        orThrow(api().settings.updateMcp({ body: { enabled } })),
      meta: { invalidates: [mcpQueries.settings().queryKey] },
    }),
  /**
   * Answers a consent screen; the server says where to send the browser. An
   * approval connects the assistant.
   */
  decideAuthorization: (request: AuthorizationRequest) =>
    mutationOptions({
      mutationFn: (approve: boolean) =>
        orThrow(
          api().oauth.decideAuthorization({ body: { ...request, approve } }),
        ),
      meta: { invalidates: [mcpQueries.connections().queryKey] },
    }),
  /**
   * Disconnects an assistant: its tokens stop working at once. The grant is
   * the variable, so the list is one mutation rather than one per row.
   */
  revokeConnection: () =>
    mutationOptions({
      mutationFn: (id: number) =>
        orThrow(api().oauth.revokeGrant({ path: { id } })),
      meta: { invalidates: [mcpQueries.connections().queryKey] },
    }),
};
