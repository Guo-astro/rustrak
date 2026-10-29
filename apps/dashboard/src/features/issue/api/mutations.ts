/**
 * Writes to issues.
 *
 * A change of status, a delete or a bulk action moves the project's counts
 * (the overview, the stats, the release pages), which live outside this slice:
 * those invalidate the whole `projectScope`.
 */
import type {
  BulkDeleteIssues,
  BulkUpdateIssues,
  UpdateIssueState,
} from '@rustrak/client';
import { mutationOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { issueQueries } from './queries';

export const issueMutations = {
  /**
   * Resolve, mute, reprioritise… `{ status: 'resolvedInNextRelease' }` marks
   * the issue resolved but tracks the pending release, so a regression before
   * the deploy reopens it and a recorded deploy finalises it.
   */
  update: (projectId: number, issueId: string) =>
    mutationOptions({
      mutationFn: (state: UpdateIssueState) =>
        orThrow(
          api().issues.update({
            path: { project_id: projectId, issue_id: issueId },
            body: state,
          }),
        ),
      meta: { invalidates: [projectScope(projectId)] },
    }),
  bulkUpdate: (projectId: number) =>
    mutationOptions({
      mutationFn: (body: BulkUpdateIssues) =>
        orThrow(
          api().issues.bulkUpdate({ path: { project_id: projectId }, body }),
        ),
      meta: { invalidates: [projectScope(projectId)] },
    }),
  bulkDelete: (projectId: number) =>
    mutationOptions({
      mutationFn: (body: BulkDeleteIssues) =>
        orThrow(
          api().issues.bulkDelete({ path: { project_id: projectId }, body }),
        ),
      meta: { invalidates: [projectScope(projectId)] },
    }),
  delete: (projectId: number, issueId: string) =>
    mutationOptions({
      mutationFn: () =>
        orThrow(
          api().issues.delete({
            path: { project_id: projectId, issue_id: issueId },
          }),
        ),
      meta: { invalidates: [projectScope(projectId)] },
    }),
  /** A note on the issue's activity log. */
  comment: (projectId: number, issueId: string) =>
    mutationOptions({
      mutationFn: (text: string) =>
        orThrow(
          api().issues.createComment({
            path: { project_id: projectId, issue_id: issueId },
            body: { text },
          }),
        ),
      meta: { invalidates: [issueQueries.one(projectId, issueId)] },
    }),
  /** The reader's own bookmark, which the lists can filter on. */
  bookmark: (projectId: number, issueId: string) =>
    mutationOptions({
      mutationFn: (enabled: boolean) =>
        orThrow(
          api().issues.setBookmark({
            path: { project_id: projectId, issue_id: issueId },
            body: { enabled },
          }),
        ),
      meta: {
        invalidates: [
          issueQueries.one(projectId, issueId),
          issueQueries.lists(projectId),
        ],
      },
    }),
  /** The reader's own subscription to the issue's notifications. */
  subscribe: (projectId: number, issueId: string) =>
    mutationOptions({
      mutationFn: (enabled: boolean) =>
        orThrow(
          api().issues.setSubscription({
            path: { project_id: projectId, issue_id: issueId },
            body: { enabled },
          }),
        ),
      meta: { invalidates: [issueQueries.one(projectId, issueId)] },
    }),
};
