/**
 * Reads for the GitHub integration: the instance's connection and the
 * reader's login under `['github']`, a project's repository and what an issue
 * knows from GitHub under the project's scope.
 */
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

export const githubQueries = {
  /** Every instance-wide GitHub read. */
  root: () => ['github'] as const,
  /** Every GitHub read of one project. */
  all: (projectId: number) => [...projectScope(projectId), 'github'] as const,
  status: () =>
    queryOptions({
      queryKey: [...githubQueries.root(), 'status'],
      queryFn: ({ signal }) => orThrow(api().github.status({ signal })),
    }),
  /** The reader's own GitHub login, which maps GitHub users to them. */
  myLogin: () =>
    queryOptions({
      queryKey: [...githubQueries.root(), 'me'],
      queryFn: ({ signal }) => orThrow(api().github.getMyLogin({ signal })),
    }),
  /** The repositories the installation can see, to pick one for a project. */
  repositories: (projectId: number) =>
    queryOptions({
      queryKey: [...githubQueries.all(projectId), 'repositories'],
      queryFn: ({ signal }) =>
        orThrow(
          api().github.repositories({
            query: { project_id: projectId },
            signal,
          }),
        ),
    }),
  /** The project's repository, or `null` when none is set. */
  repository: (projectId: number) =>
    queryOptions({
      queryKey: [...githubQueries.all(projectId), 'repository'],
      queryFn: ({ signal }) =>
        orThrow(
          api().github.getProjectRepository({
            path: { project_id: projectId },
            signal,
          }),
        ),
    }),
  issue: (projectId: number, issueId: string) =>
    queryOptions({
      queryKey: [...githubQueries.all(projectId), 'issue', issueId],
      queryFn: ({ signal }) =>
        orThrow(
          api().github.issue({
            path: { project_id: projectId, issue_id: issueId },
            signal,
          }),
        ),
    }),
};
