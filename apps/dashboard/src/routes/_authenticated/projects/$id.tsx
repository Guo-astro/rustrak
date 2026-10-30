import { noop } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { projectQueries } from '@/features/project/api/queries';

/**
 * The project every screen under `/projects/$id` belongs to.
 *
 * It renders nothing of its own. Its loader starts the project's read, which
 * the sidebar and the trail (`-components/app-frame.tsx`) and every page
 * below subscribe to; a project that cannot be read fails in the page that
 * suspends on it, under that page's error boundary.
 */
export const Route = createFileRoute('/_authenticated/projects/$id')({
  loader: ({ context: { queryClient }, params }) => {
    void queryClient
      .query(projectQueries.detail(Number.parseInt(params.id, 10)))
      .catch(noop);
  },
});
