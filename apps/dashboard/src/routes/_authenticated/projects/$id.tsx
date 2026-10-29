import { createFileRoute } from '@tanstack/react-router';
import { projectQueries } from '@/features/project/api/queries';

/**
 * The project every screen under `/projects/$id` belongs to.
 *
 * It renders nothing of its own. Its loader puts the project in the cache,
 * where the sidebar and the trail read it (`-components/app-frame.tsx`) and
 * where every page below finds it without asking again. A project that cannot
 * be read fails here, once: every page below needs it.
 */
export const Route = createFileRoute('/_authenticated/projects/$id')({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.query({
      ...projectQueries.detail(Number.parseInt(params.id, 10)),
      staleTime: 'static',
    }),
});
