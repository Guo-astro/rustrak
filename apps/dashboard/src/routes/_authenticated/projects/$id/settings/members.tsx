import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { userQueries } from '@/features/user/api/queries';
import { MembersSettings } from '@/features/user/ui/components/members-settings';
import { translator } from '@/shared/i18n/intl';
import { useSessionUser } from '@/shared/ui/hooks/use-session-user';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/settings/members',
)({
  head: () => ({
    meta: [{ title: translator('settings')('members.meta.title') }],
  }),
  // The members decide what the reader may do here, so they are awaited: a
  // failed read ends in the error boundary rather than in an empty list beside
  // a permission verdict computed from it.
  loader: ({ context: { queryClient }, params }) =>
    queryClient.query({
      ...userQueries.members(Number.parseInt(params.id, 10)),
      staleTime: 'static',
    }),
  component: MembersSettingsPage,
});

function MembersSettingsPage() {
  const { id } = Route.useParams();
  const currentUser = useSessionUser();
  const projectId = Number.parseInt(id, 10);
  const { data: members } = useSuspenseQuery(userQueries.members(projectId));

  const currentMembership = members.find(
    (member) => member.user_id === currentUser.id,
  );
  const canManageMembers =
    currentUser.role === 'admin' || currentMembership?.role === 'admin';

  return (
    <MembersSettings
      projectId={projectId}
      members={members}
      currentUserId={currentUser.id}
      canManage={canManageMembers}
    />
  );
}
