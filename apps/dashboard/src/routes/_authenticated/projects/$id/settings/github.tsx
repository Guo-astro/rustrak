import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { githubQueries } from '@/features/github/api/queries';
import { RepositorySettings } from '@/features/github/ui/components/repository-settings';
import { projectQueries } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { SettingsHeader } from '@/shared/ui/components/settings-header';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/github',
)({
  head: () => ({
    meta: [{ title: translator('github')('repository.metaTitle') }],
  }),
  loader: ({ context: { queryClient }, params }) => {
    const projectId = Number.parseInt(params.id, 10);
    // The repository list is awaited but never throws: its failure is how
    // the page says GitHub is not connected yet.
    return Promise.all([
      queryClient.query({
        ...githubQueries.repository(projectId),
        staleTime: 'static',
      }),
      queryClient.prefetchQuery(githubQueries.repositories(projectId)),
    ]);
  },
  component: GitHubSettingsPage,
});

function GitHubSettingsPage() {
  const t = useTranslations('github');
  const projectId = Number.parseInt(Route.useParams().id, 10);
  const { data: project } = useSuspenseQuery(projectQueries.detail(projectId));
  const { data: repository } = useSuspenseQuery(
    githubQueries.repository(projectId),
  );

  return (
    <>
      <SettingsHeader title="GitHub" description={t('repository.subtitle')} />
      <RepositorySettings
        // A new repository starts from its own saved mappings.
        key={repository?.repo_full_name ?? 'none'}
        projectId={project.id}
        projectSlug={project.slug}
        repository={repository}
      />
    </>
  );
}
