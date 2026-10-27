import { createFileRoute, redirect } from '@tanstack/react-router';

/** Products live on the Data page, beside the event limits. */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/products',
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/projects/$id/settings/data',
      params: { id: params.id },
    });
  },
});
