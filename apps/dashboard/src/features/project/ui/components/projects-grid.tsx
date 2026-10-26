import type { ProjectResponse, ProjectsListResponse } from '@rustrak/client';
import { Button, EmptyIcon, NewIcon, Text } from '@rustrak/ui';
import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { deleteProject } from '@/features/project/api/mutations';
import { Link } from '@/shared/ui/components/link';
import { TablePagination } from '@/shared/ui/components/table-pagination';
import { useRouter } from '@/shared/ui/hooks/use-router';
import { DeleteProjectsDialog } from './delete-projects-dialog';
import { ProjectCard } from './project-card';

interface ProjectsGridProps {
  initialProjects: ProjectsListResponse;
  currentPage: number;
}

/** Every project the reader can see, one card each, a page at a time. */
export function ProjectsGrid({
  initialProjects,
  currentPage,
}: ProjectsGridProps) {
  const t = useTranslations('projects');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { items, total_count, total_pages, per_page } = initialProjects;

  // The card leaves at once; the refresh afterwards puts it back if the
  // delete did not go through.
  const [projects, removeOptimistic] = useOptimistic(
    items,
    (state, deletedId: number) => state.filter((p) => p.id !== deletedId),
  );
  const [pendingDelete, setPendingDelete] = useState<ProjectResponse | null>(
    null,
  );

  const confirmDelete = () => {
    const target = pendingDelete;
    if (!target) return;
    // Closed first: the card is about to vanish, and a confirmation still
    // sitting over it reads as a click that did nothing.
    setPendingDelete(null);

    startTransition(async () => {
      removeOptimistic(target.id);
      const result = await deleteProject(target.id);

      if (result.success) {
        toast.success(t('toasts.deleted', { count: 1 }));
      } else {
        toast.error(t('toasts.deleteFailed'), {
          description: result.error.message,
        });
      }
      router.refresh();
    });
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-24 text-center">
        <EmptyIcon size="2xl" className="mb-2 text-fg-ghost" />
        <Text variant="card-title">{t('empty.title')}</Text>
        <Text variant="meta" tone="subtle">
          {t('empty.hint')}
        </Text>
        <Button
          variant="primary"
          icon={NewIcon}
          className="mt-4"
          render={<Link href="/projects/new" />}
        >
          {t('newProject')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={setPendingDelete}
          />
        ))}
      </div>

      {total_pages > 1 ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={total_pages}
          totalCount={total_count}
          perPage={per_page}
          disabled={isPending}
          onPageChange={(page) => router.push(`/projects?page=${page}`)}
        />
      ) : null}

      <DeleteProjectsDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        count={1}
        targetName={pendingDelete?.name}
        isPending={isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
