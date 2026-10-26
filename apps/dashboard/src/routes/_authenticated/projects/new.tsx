import { Page, PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getProjects } from '@/features/project/api/queries';
import { CreateProjectForm } from '@/features/project/ui/components/create-project-form/create-project-form';
import { translator } from '@/shared/i18n/intl';

/**
 * Create-project page: platform picker plus name, in one form.
 *
 * A full page rather than a dialog, matching Sentry's own `/projects/new/`.
 */
export const Route = createFileRoute('/_authenticated/projects/new')({
  head: () => {
    const t = translator('projectPages');
    return {
      meta: [
        { title: t('newProject.meta.title') },
        { name: 'description', content: t('newProject.meta.description') },
      ],
    };
  },
  // Only used to suggest a free default name. `projects.name` is UNIQUE, so
  // the raw platform id Sentry pre-fills would collide on a second Next.js
  // project. One page is enough for a suggestion; the server still has the
  // final say and returns a 409 on a genuine collision.
  //
  // A failed lookup only costs a less clever default name, so it must not block
  // project creation: this is one of the few places where discarding the
  // failure is the right answer, and it is written out rather than swallowed by
  // a `catch`.
  loader: async () => {
    const existing = await getProjects({ page: 1, per_page: 100 });
    return existing.success ? existing.data.items.map((p) => p.name) : [];
  },
  component: NewProjectPage,
});

function NewProjectPage() {
  const t = useTranslations('projectPages');
  const existingNames = Route.useLoaderData();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('newProject.title')}
        summary={[t('newProject.subtitle')]}
      />
      <Page>
        <CreateProjectForm existingNames={existingNames} />
      </Page>
    </div>
  );
}
