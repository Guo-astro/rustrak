import { createFileRoute, redirect } from '@tanstack/react-router';

/** Moved to `/settings/instance` in the settings redesign; kept so links still land. */
export const Route = createFileRoute('/_authenticated/settings/about')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/instance' });
  },
});
