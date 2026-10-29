/**
 * Reads for the log feature: the lines, and how many there were over time.
 */
import type { LogsListData, LogsVolumeData } from '@rustrak/client';
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

type LogsListQuery = NonNullable<LogsListData['query']>;
type LogsVolumeQuery = NonNullable<LogsVolumeData['query']>;

export const logQueries = {
  all: (projectId: number) => [...projectScope(projectId), 'logs'] as const,
  list: (projectId: number, query: LogsListQuery = {}) =>
    queryOptions({
      queryKey: [...logQueries.all(projectId), 'list', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().logs.list({ path: { project_id: projectId }, query, signal }),
        ),
    }),
  detail: (projectId: number, logId: string) =>
    queryOptions({
      queryKey: [...logQueries.all(projectId), 'detail', logId],
      queryFn: ({ signal }) =>
        orThrow(
          api().logs.get({
            path: { project_id: projectId, log_id: logId },
            signal,
          }),
        ),
    }),
  volume: (projectId: number, query: LogsVolumeQuery = {}) =>
    queryOptions({
      queryKey: [...logQueries.all(projectId), 'volume', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().logs.volume({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
};
