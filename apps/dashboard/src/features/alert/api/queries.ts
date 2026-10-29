/**
 * Reads for the alert feature: the rules a project has, and the integrations
 * they route to. A rule without an integration does nothing, which is why the
 * two live in one slice.
 *
 * Integrations are instance-wide, so they have their own root; rules and their
 * deliveries belong to a project.
 */
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

export const alertQueries = {
  /** Every integration read, the template previews included. */
  integrationsRoot: () => ['integrations'] as const,
  integrations: () =>
    queryOptions({
      queryKey: [...alertQueries.integrationsRoot(), 'list'],
      queryFn: ({ signal }) => orThrow(api().alertChannels.list({ signal })),
    }),
  /**
   * A Custom Webhook body template rendered against a sample payload.
   *
   * The dashboard cannot run the template engine, so the preview under the
   * editor comes from the server: the same renderer a delivery uses, which is
   * the only way the preview cannot lie about what will be sent. A POST, but
   * it writes nothing, so it is cached by the template it rendered.
   */
  templatePreview: (template: string) =>
    queryOptions({
      queryKey: [
        ...alertQueries.integrationsRoot(),
        'template-preview',
        template,
      ],
      queryFn: ({ signal }) =>
        orThrow(
          api().alertChannels.previewTemplate({ body: { template }, signal }),
        ),
    }),

  all: (projectId: number) => [...projectScope(projectId), 'alerts'] as const,
  /** A project's rules: the list and every single rule. */
  rules: (projectId: number) =>
    [...alertQueries.all(projectId), 'rules'] as const,
  ruleList: (projectId: number) =>
    queryOptions({
      queryKey: [...alertQueries.rules(projectId), 'list'],
      queryFn: ({ signal }) =>
        orThrow(
          api().alertRules.list({ path: { project_id: projectId }, signal }),
        ),
    }),
  rule: (projectId: number, ruleId: number) =>
    queryOptions({
      queryKey: [...alertQueries.rules(projectId), 'detail', ruleId],
      queryFn: ({ signal }) =>
        orThrow(
          api().alertRules.get({
            path: { project_id: projectId, rule_id: ruleId },
            signal,
          }),
        ),
    }),
  /** A project's deliveries, listed and counted per day. */
  histories: (projectId: number) =>
    [...alertQueries.all(projectId), 'history'] as const,
  /** A project's deliveries, newest first; with `ruleId`, only that rule's. */
  history: (
    projectId: number,
    query: { ruleId?: number; limit?: number } = {},
  ) =>
    queryOptions({
      queryKey: [...alertQueries.histories(projectId), 'list', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().alertRules.listHistory({
            path: { project_id: projectId },
            query: { rule_id: query.ruleId, limit: query.limit },
            signal,
          }),
        ),
    }),
  /** Deliveries per UTC day over the last `days`, every delivery counted. */
  historyByDay: (projectId: number, query: { ruleId?: number; days: number }) =>
    queryOptions({
      queryKey: [...alertQueries.histories(projectId), 'by-day', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().alertRules.historyByDay({
            path: { project_id: projectId },
            query: { rule_id: query.ruleId, days: query.days },
            signal,
          }),
        ),
    }),
};
