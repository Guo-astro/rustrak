/**
 * Reads for the alert feature: the rules a project has, and the integrations
 * they route to. A rule without an integration does nothing, which is why the
 * two live in one slice.
 */
import type {
  AlertHistory,
  AlertHistoryDay,
  AlertIntegration,
  AlertRuleResponse,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

// ============================================================================
// Alert Integrations (Global Credential Destinations)
// ============================================================================

export async function listIntegrations(): Promise<
  Result<AlertIntegration[], RustrakError>
> {
  const client = await createClient();
  return client.alertChannels.list();
}

export async function listAlertRules(
  projectId: number,
): Promise<Result<AlertRuleResponse[], RustrakError>> {
  const client = await createClient();
  return client.alertRules.list({ path: { project_id: projectId } });
}

/** A project's deliveries, newest first; with `ruleId`, only that rule's. */
export async function listAlertHistory(
  projectId: number,
  options?: { ruleId?: number; limit?: number },
): Promise<Result<AlertHistory[], RustrakError>> {
  const client = await createClient();
  return client.alertRules.listHistory({
    path: { project_id: projectId },
    query: { rule_id: options?.ruleId, limit: options?.limit },
  });
}

/** Deliveries per UTC day over the last `days`, every delivery counted. */
export async function getAlertHistoryByDay(
  projectId: number,
  options: { ruleId?: number; days: number },
): Promise<Result<AlertHistoryDay[], RustrakError>> {
  const client = await createClient();
  return client.alertRules.historyByDay({
    path: { project_id: projectId },
    query: { rule_id: options.ruleId, days: options.days },
  });
}

export async function getAlertRule(
  projectId: number,
  ruleId: number,
): Promise<Result<AlertRuleResponse, RustrakError>> {
  const client = await createClient();
  return client.alertRules.get({
    path: { project_id: projectId, rule_id: ruleId },
  });
}
