/**
 * Reads for the issues feature.
 *
 * Everything about one issue sits under `issueQueries.one(...)`, so a write to
 * it refreshes its detail, aggregates, chart, activity and reports together.
 */
import type {
  FeedbackListData,
  IssuesGetStatsData,
  IssuesListData,
} from '@rustrak/client';
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

type IssuesListQuery = IssuesListData['query'];
type IssueStatsWindow = NonNullable<IssuesGetStatsData['query']>['window'];
type FeedbackListQuery = FeedbackListData['query'];

export const issueQueries = {
  all: (projectId: number) => [...projectScope(projectId), 'issues'] as const,
  /** Every page and filter of the issues list. */
  lists: (projectId: number) =>
    [...issueQueries.all(projectId), 'list'] as const,
  /** Everything about one issue. */
  one: (projectId: number, issueId: string) =>
    [...issueQueries.all(projectId), 'issue', issueId] as const,
  list: (projectId: number, query: IssuesListQuery = {}) =>
    queryOptions({
      queryKey: [...issueQueries.lists(projectId), query],
      queryFn: ({ signal }) =>
        orThrow(
          api().issues.list({ path: { project_id: projectId }, query, signal }),
        ),
    }),
  detail: (projectId: number, issueId: string) =>
    queryOptions({
      queryKey: [...issueQueries.one(projectId, issueId), 'detail'],
      queryFn: ({ signal }) =>
        orThrow(
          api().issues.get({
            path: { project_id: projectId, issue_id: issueId },
            signal,
          }),
        ),
    }),
  /** Unique user count and top tags. */
  aggregates: (projectId: number, issueId: string) =>
    queryOptions({
      queryKey: [...issueQueries.one(projectId, issueId), 'aggregates'],
      queryFn: ({ signal }) =>
        orThrow(
          api().issues.getAggregates({
            path: { project_id: projectId, issue_id: issueId },
            signal,
          }),
        ),
    }),
  /** A zero-filled event-count timeseries over the window. */
  stats: (
    projectId: number,
    issueId: string,
    window: IssueStatsWindow = '24h',
  ) =>
    queryOptions({
      queryKey: [...issueQueries.one(projectId, issueId), 'stats', window],
      queryFn: ({ signal }) =>
        orThrow(
          api().issues.getStats({
            path: { project_id: projectId, issue_id: issueId },
            query: { window },
            signal,
          }),
        ),
    }),
  /** Status changes, comments and links, as the activity log records them. */
  activity: (projectId: number, issueId: string) =>
    queryOptions({
      queryKey: [...issueQueries.one(projectId, issueId), 'activity'],
      queryFn: ({ signal }) =>
        orThrow(
          api().issues.getActivity({
            path: { project_id: projectId, issue_id: issueId },
            signal,
          }),
        ),
    }),
  /** A page of the feedback users sent about the issue, newest first. */
  userReports: (projectId: number, issueId: string, page?: number) =>
    queryOptions({
      queryKey: [...issueQueries.one(projectId, issueId), 'user-reports', page],
      queryFn: ({ signal }) =>
        orThrow(
          api().issues.listUserReports({
            path: { project_id: projectId, issue_id: issueId },
            query: { page },
            signal,
          }),
        ),
    }),
  /** The project's whole feedback mailbox, with what each user submitted. */
  feedback: (projectId: number, query: FeedbackListQuery = {}) =>
    queryOptions({
      queryKey: [...issueQueries.all(projectId), 'feedback', query],
      queryFn: ({ signal }) =>
        orThrow(
          api().feedback.list({
            path: { project_id: projectId },
            query,
            signal,
          }),
        ),
    }),
};
