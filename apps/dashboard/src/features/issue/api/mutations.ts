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
import { ApiError, orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { issueQueries } from './queries';

export const issueMutations = {
  /**
   * Resolve, mute, reprioritise… `{ status: 'resolvedInNextRelease' }` marks
   * the issue resolved but tracks the pending release, so a regression before
   * the deploy reopens it and a recorded deploy finalises it.
   *
   * The issue is a variable, not a parameter: a list acts on whichever row
   * the reader is on.
   */
  update: (projectId: number) =>
    mutationOptions({
      mutationFn: ({
        issueId,
        state,
      }: {
        issueId: string;
        state: UpdateIssueState;
      }) =>
        orThrow(
          api().issues.update({
            path: { project_id: projectId, issue_id: issueId },
            body: state,
          }),
        ),
      meta: { invalidates: [projectScope(projectId)] },
    }),
  /**
   * Assigns some issues. The API assigns one issue at a time, so this is one
   * request per issue, all of them settled before the first failure is
   * thrown: the others went through, and the refetch has to show them.
   */
  assign: (projectId: number) =>
    mutationOptions({
      mutationFn: async ({
        ids,
        assignedTo,
      }: {
        ids: string[];
        assignedTo: number | null;
      }) => {
        const results = await Promise.all(
          ids.map((id) =>
            api().issues.update({
              path: { project_id: projectId, issue_id: id },
              body: { assigned_to: assignedTo },
            }),
          ),
        );
        for (const result of results) {
          if (!result.success) throw new ApiError(result.error);
        }
      },
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
  delete: (projectId: number) =>
    mutationOptions({
      mutationFn: (issueId: string) =>
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
