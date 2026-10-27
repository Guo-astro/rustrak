import { createFileRoute } from '@tanstack/react-router';
import { getProject } from '@/features/project/api/queries';

/**
 * The project every screen under `/projects/$id` belongs to.
 *
 * It renders nothing of its own: the sidebar and the trail read this loader
 * (`useMatch` in `-components/app-frame.tsx`) to name the project and switch
 * the sidebar into its routes. The fetch is not fatal here; the frame shows a
 * placeholder name and the page below is where a failure gets words.
 */
export const Route = createFileRoute('/_authenticated/projects/$id')({
  loader: async ({ params }) => ({
    project: await getProject(Number.parseInt(params.id, 10)),
  }),
});
