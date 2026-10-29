import type {
  CreateAlertIntegration,
  CreateAlertRule,
  UpdateAlertIntegration,
  UpdateAlertRule,
} from '@rustrak/client';
import { mutationOptions } from '@tanstack/react-query';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { alertQueries } from './queries';

export const alertMutations = {
  createIntegration: () =>
    mutationOptions({
      mutationFn: (body: CreateAlertIntegration) =>
        orThrow(api().alertChannels.create({ body })),
      meta: { invalidates: [alertQueries.integrations().queryKey] },
    }),
  updateIntegration: (id: number) =>
    mutationOptions({
      mutationFn: (body: UpdateAlertIntegration) =>
        orThrow(api().alertChannels.update({ path: { id }, body })),
      meta: { invalidates: [alertQueries.integrations().queryKey] },
    }),
  /**
   * Rules in any project may route to the integration and lose it, and no key
   * narrower than every project's holds all of them.
   */
  deleteIntegration: (id: number) =>
    mutationOptions({
      mutationFn: () => orThrow(api().alertChannels.delete({ path: { id } })),
      meta: {
        invalidates: [alertQueries.integrations().queryKey, ['projects']],
      },
    }),
  /** Sends a sample alert through the integration; records nothing. */
  testIntegration: (id: number) =>
    mutationOptions({
      mutationFn: (routingOverride?: Record<string, unknown>) =>
        orThrow(
          api().alertChannels.test({
            path: { id },
            body:
              routingOverride === undefined
                ? undefined
                : { routing_override: routingOverride },
          }),
        ),
    }),

  createRule: (projectId: number) =>
    mutationOptions({
      mutationFn: (body: CreateAlertRule) =>
        orThrow(
          api().alertRules.create({ path: { project_id: projectId }, body }),
        ),
      meta: { invalidates: [alertQueries.rules(projectId)] },
    }),
  updateRule: (projectId: number, ruleId: number) =>
    mutationOptions({
      mutationFn: (body: UpdateAlertRule) =>
        orThrow(
          api().alertRules.update({
            path: { project_id: projectId, rule_id: ruleId },
            body,
          }),
        ),
      meta: { invalidates: [alertQueries.rules(projectId)] },
    }),
  /** The rule's deliveries go with it, so the history changes too. */
  deleteRule: (projectId: number, ruleId: number) =>
    mutationOptions({
      mutationFn: () =>
        orThrow(
          api().alertRules.delete({
            path: { project_id: projectId, rule_id: ruleId },
          }),
        ),
      meta: { invalidates: [alertQueries.all(projectId)] },
    }),
};
