import { TeamIcon } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { listTeam } from '@/features/user/api/mutations';
import { listInvitations } from '@/features/user/api/queries';
import { InviteForm } from '@/features/user/ui/components/invite-form';
import { PendingInvitations } from '@/features/user/ui/components/pending-invitations';
import { TeamMembersList } from '@/features/user/ui/components/team-members-list';
import { session } from '@/shared/api/session';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsEmpty } from '@/shared/ui/components/setting-row';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import { useSessionUser } from '@/shared/ui/hooks/use-session-user';

export const Route = createFileRoute('/_authenticated/settings/team')({
  head: () => {
    const t = translator('settings');
    return {
      meta: [
        { title: t('team.meta.title') },
        { name: 'description', content: t('team.meta.description') },
      ],
    };
  },
  /**
   * The roster is fetched only for an admin.
   *
   * Not an optimisation: a non-admin gets a 403 from both endpoints, and
   * loading them anyway would put "we could not load the team" underneath the
   * "you are not authorised" panel that already explains why.
   */
  loader: async () => {
    const answer = session.peek();
    if (answer?.state !== 'authenticated' || answer.user.role !== 'admin') {
      return null;
    }
    return loadAll([listTeam(), listInvitations()]);
  },
  component: TeamPage,
});

function TeamPage() {
  const t = useTranslations('settings');
  const user = useSessionUser();
  const loaded = Route.useLoaderData();

  const heading = (
    <SettingsHeader title={t('team.title')} description={t('team.subtitle')} />
  );

  // Guard: only instance admins may manage the team. The "we could not ask"
  // branch that used to sit above this one belongs to `_authenticated` now —
  // an outage is not a permission verdict, and reporting one as the other is
  // the bug that branch exists to prevent.
  if (user.role !== 'admin' || loaded === null) {
    return (
      <>
        {heading}
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
          <SettingsEmpty
            icon={<TeamIcon size="2xl" />}
            title={t('notAuthorized')}
            description={t('team.notAuthorizedDescription')}
          />
        </div>
      </>
    );
  }

  if (!loaded.success) {
    return (
      <LoadFailure
        error={loaded.error}
        title={t('team.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  const [members, invitations] = loaded.data;

  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === 'pending',
  );

  return (
    <>
      {heading}
      <InviteForm />
      <TeamMembersList members={members} currentUserId={user.id} />
      <PendingInvitations invitations={pendingInvitations} />
    </>
  );
}
