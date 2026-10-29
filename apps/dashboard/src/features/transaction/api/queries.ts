/**
 * Reads for the transaction feature: endpoints and their samples.
 */
import type {
  TransactionStatsResponse,
  TransactionsGetStatGroupData,
  TransactionsGetStatGroupTimeseriesData,
  TransactionsGetStatsData,
  TransactionsListData,
} from '@rustrak/client';
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { ApiError, orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

type TransactionsListQuery = NonNullable<TransactionsListData['query']>;
type TransactionStatsQuery = NonNullable<TransactionsGetStatsData['query']>;
type StatGroupQuery = TransactionsGetStatGroupData['query'];
type StatGroupTrendQuery = TransactionsGetStatGroupTimeseriesData['query'];

export const transactionQueries = {
  all: (projectId: number) =>
    [...projectScope(projectId), 'transactions'] as const,
  list: (projectId: number, query: TransactionsListQuery = {}) =>
    queryOptions({
      queryKey: [...transactionQueries.all(projectId), 'list', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().transactions.list({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
  detail: (projectId: number, transactionId: string) =>
    queryOptions({
      queryKey: [...transactionQueries.all(projectId), 'detail', transactionId],
      queryFn: ({ signal }) =>
        orThrow(
          api().transactions.get({
            path: { project_id: projectId, transaction_id: transactionId },
            signal,
          }),
        ),
    }),
  stats: (projectId: number, query: TransactionStatsQuery = {}) =>
    queryOptions({
      queryKey: [...transactionQueries.all(projectId), 'stats', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().transactions.getStats({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
  /**
   * Aggregate metrics for one transaction group, or `null` when the group has
   * never been sampled.
   *
   * `not_found` is how the server says "no rows under this name", a real empty
   * answer. Every other failure stays a failure: swallowing `network` and
   * `server_error` too would render an outage as "this endpoint has no
   * metrics".
   */
  group: (projectId: number, query: StatGroupQuery) =>
    queryOptions({
      queryKey: [...transactionQueries.all(projectId), 'group', query],
      queryFn: async ({ signal }): Promise<TransactionStatsResponse | null> => {
        try {
          return await orThrow(
            api().transactions.getStatGroup({
              path: { project_id: projectId },
              query,
              signal,
            }),
          );
        } catch (error) {
          if (error instanceof ApiError && error.error.kind === 'not_found') {
            return null;
          }
          throw error;
        }
      },
    }),
  /** One endpoint's runs, failures, p50 and p95 per bucket over the window. */
  groupTrend: (projectId: number, query: StatGroupTrendQuery) =>
    queryOptions({
      queryKey: [...transactionQueries.all(projectId), 'group-trend', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().transactions.getStatGroupTimeseries({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
};
