import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import {
  getGitHubStatus,
  getMyGitHubLogin,
} from '@/features/github/api/queries';
import { GitHubIntegration } from '@/features/github/ui/components/github-integration';
import { GitHubLoginCard } from '@/features/github/ui/components/github-login-card';
import { GitHubMark } from '@/shared/ui/components/github-mark';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';

export const Route = createFileRoute(
  '/_authenticated/settings/integrations/github',
)({
  head: () => ({ meta: [{ title: 'GitHub | Rustrak' }] }),
  loader: async () => {
    const [status, login] = await Promise.all([
      getGitHubStatus(),
      getMyGitHubLogin(),
    ]);
    return { status, login };
  },
  component: GitHubIntegrationPage,
});

/** Everything about GitHub, including which GitHub account is the reader's. */
function GitHubIntegrationPage() {
  const t = useTranslations('settings');
  const tGitHub = useTranslations('github');
  const { status, login } = Route.useLoaderData();
  usePageTrail([{ label: 'GitHub' }]);
  const loginCard = login.success ? (
    <GitHubLoginCard login={login.data.login} />
  ) : (
    <LoadFailure
      error={login.error}
      title={t('integrations.githubLoadFailed')}
      notFoundOnMissing={false}
    />
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
      {status.success ? (
        <GitHubIntegration status={status.data} login={loginCard} />
      ) : status.error.kind === 'forbidden' ? (
        // The app and its installations are an admin's; which GitHub account
        // is theirs is every member's to set.
        loginCard
      ) : (
        <LoadFailure
          error={status.error}
          title={t('integrations.githubLoadFailed')}
          notFoundOnMissing={false}
        />
      )}
    </>
  );
}
