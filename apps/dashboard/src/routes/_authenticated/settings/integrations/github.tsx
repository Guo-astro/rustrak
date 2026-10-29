import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { githubQueries } from '@/features/github/api/queries';
import { GitHubIntegration } from '@/features/github/ui/components/github-integration';
import { GitHubLoginCard } from '@/features/github/ui/components/github-login-card';
import { GitHubMark } from '@/shared/ui/components/github-mark';
import { QueryState } from '@/shared/ui/components/query-state';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/settings/integrations/github',
)({
  head: () => ({ meta: [{ title: 'GitHub | Rustrak' }] }),
  // The connection is the page; the reader's own login is a card that fills
  // in on its own.
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(githubQueries.myLogin());
    return queryClient.query({
      ...githubQueries.status(),
      staleTime: 'static',
    });
  },
  component: GitHubIntegrationPage,
});

/** Everything about GitHub, including which GitHub account is the reader's. */
function GitHubIntegrationPage() {
  const t = useTranslations('settings');
  const tGitHub = useTranslations('github');
  const { data: status } = useSuspenseQuery(githubQueries.status());
  const login = useQuery(githubQueries.myLogin());
  usePageTrail([{ label: 'GitHub' }]);
  const loginCard = (
    <QueryState
      query={login}
      placeholder={null}
      title={t('integrations.githubLoadFailed')}
    >
      {(data) => <GitHubLoginCard login={data.login} />}
    </QueryState>
  );

  return (
    <>
      <SettingsHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle text-fg">
              <GitHubMark className="size-5" />
            </span>
            GitHub
          </span>
        }
        description={tGitHub('connection.description')}
      />
      {status === null ? (
        // The app and its installations are an admin's; which GitHub account
        // is theirs is every member's to set.
        loginCard
      ) : (
        <GitHubIntegration status={status} login={loginCard} />
      )}
    </>
  );
}
