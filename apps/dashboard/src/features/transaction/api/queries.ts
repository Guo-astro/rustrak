/**
 * Reads for the transaction feature: endpoints and their samples.
 */
import type {
  Result,
  RustrakError,
  TransactionDetailResponse,
  TransactionStatsResponse,
  TransactionsGetStatGroupTimeseriesResponse,
  TransactionsGetStatsData,
  TransactionsGetStatsResponse,
  TransactionsListData,
  TransactionsListResponse,
} from '@rustrak/client';
import { Ok } from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

export async function listTransactions(
  projectId: number,
  options?: NonNullable<TransactionsListData['query']>,
): Promise<Result<TransactionsListResponse, RustrakError>> {
  const client = await createClient();
  return client.transactions.list({
    path: { project_id: projectId },
    query: options,
  });
}

export async function getTransaction(
  projectId: number,
  transactionId: string,
): Promise<Result<TransactionDetailResponse, RustrakError>> {
  const client = await createClient();
  return client.transactions.get({
    path: { project_id: projectId, transaction_id: transactionId },
  });
}

export async function getTransactionStats(
  projectId: number,
  options?: NonNullable<TransactionsGetStatsData['query']>,
): Promise<Result<TransactionsGetStatsResponse, RustrakError>> {
  const client = await createClient();
  return client.transactions.getStats({
    path: { project_id: projectId },
    query: options,
  });
}

/**
 * Aggregate metrics for one transaction group, or `null` when the group has
 * never been sampled.
 *
 * `not_found` is how the server says "no rows under this name", which is a real
 * empty answer and becomes `Ok(null)`. Every other failure stays a failure: the
 * previous `.catch(() => null)` also swallowed `network` and `server_error`, so
 * an outage rendered as "this endpoint has no metrics".
 */
export async function getTransactionStatForGroup(
  projectId: number,
  name: string,
  op?: string,
  scope?: EndpointScope,
): Promise<Result<TransactionStatsResponse | null, RustrakError>> {
  const client = await createClient();
  const result = await client.transactions.getStatGroup({
    path: { project_id: projectId },
    query: { name, op, ...scope },
  });

  if (!result.success && result.error.kind === 'not_found') {
    return Ok(null);
  }

  return result;
}

/** The window and environment an endpoint is read in. */
export interface EndpointScope {
  period?: string;
  environment?: string;
}

/** One endpoint's runs, failures, p50 and p95 per bucket over the window. */
export async function getEndpointTrend(
  projectId: number,
  name: string,
  op: string | undefined,
  scope: EndpointScope,
): Promise<Result<TransactionsGetStatGroupTimeseriesResponse, RustrakError>> {
  const client = await createClient();
  return client.transactions.getStatGroupTimeseries({
    path: { project_id: projectId },
    query: { name, op, ...scope },
  });
}
