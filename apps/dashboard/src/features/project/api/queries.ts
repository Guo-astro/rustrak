/**
 * Reads for the project feature.
 *
 * `stats` lives here rather than in a slice of its own: the aggregates are
 * *of a project*, not a concept a user manipulates.
 */
import type { ProjectsListData } from '@rustrak/client';
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

/** What the overview's page filters narrow every read to. */
export interface OverviewScope {
  environment?: string;
  release?: string;
}

/** Reads of projects, as `queryOptions` for the cache. */
export const projectQueries = {
  /** Every list of projects, whatever its page. */
  lists: () => ['projects', 'list'] as const,
  list: (query: ProjectsListData['query'] = {}) =>
    queryOptions({
      queryKey: [...projectQueries.lists(), query],
      queryFn: ({ signal }) => orThrow(api().projects.list({ query, signal })),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: [...projectScope(id), 'detail'],
      queryFn: ({ signal }) =>
        orThrow(api().projects.get({ path: { id }, signal })),
    }),
  /** The server's per-project limits, which a project without its own follows. */
  rateLimits: () =>
    queryOptions({
      queryKey: ['rate-limits'],
      queryFn: ({ signal }) =>
        orThrow(api().projects.getRateLimits({ signal })),
    }),
  eventTimeseries: (
    projectId: number,
    query: { period?: string; interval?: number } & OverviewScope,
  ) =>
    queryOptions({
      queryKey: [...projectScope(projectId), 'stats', 'events', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().stats.getEventTimeseries({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
  summary: (projectId: number, query: { period?: string } & OverviewScope) =>
    queryOptions({
      queryKey: [...projectScope(projectId), 'stats', 'summary', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().stats.getSummary({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
  /** The newest hundred releases' versions, for the filters that pick one. */
  releaseVersions: (projectId: number) =>
    queryOptions({
      queryKey: [...projectScope(projectId), 'releases', 'versions'],
      queryFn: async ({ signal }) => {
        const page = await orThrow(
          api().releases.list({
            path: { project_id: projectId },
            query: { per_page: 100 },
            signal,
          }),
        );
        return page.items.map((release) => release.version);
      },
    }),
  /** The environments a project's issues have been seen in, by name. */
  environments: (projectId: number) =>
    queryOptions({
      queryKey: [...projectScope(projectId), 'environments'],
      queryFn: ({ signal }) =>
        orThrow(
          api().environments.list({ path: { project_id: projectId }, signal }),
        ),
    }),
};
