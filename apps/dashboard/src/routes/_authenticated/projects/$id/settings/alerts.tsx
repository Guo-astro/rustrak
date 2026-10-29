import { createFileRoute, redirect } from '@tanstack/react-router';

/** Alerts moved out of settings; old links land on the new page. */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/alerts',
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/projects/$id/alerts',
      params,
      search: { view: undefined },
    });
  },
});
