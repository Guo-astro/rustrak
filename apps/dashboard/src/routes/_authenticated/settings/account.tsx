import { createFileRoute, redirect } from '@tanstack/react-router';

/** Moved to `/settings/profile` in the settings redesign; kept so links still land. */
export const Route = createFileRoute('/_authenticated/settings/account')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile' });
  },
});
