import type { TeamMemberResponse, UserRole } from '@rustrak/client';
import {
  Avatar,
  Button,
  DeleteIcon,
  Menu,
  MoreIcon,
  Spinner,
  Tag,
  TeamIcon,
} from '@rustrak/ui';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'use-intl';
import {
  removeTeamMember,
  updateUserRole,
} from '@/features/user/api/mutations';
import {
  SettingSection,
  SettingsEmpty,
  SettingsListItem,
} from '@/shared/ui/components/setting-row';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';
import { useRouter } from '@/shared/ui/hooks/use-router';

interface TeamMembersListProps {
  members: TeamMemberResponse[];
  currentUserId: number;
}

const USER_ROLES: UserRole[] = ['admin', 'member'];

const userRoleLabel = (role: UserRole) =>
  role === 'admin' ? 'roles.admin' : 'roles.member';

/**
 * The instance's people, one row each.
 *
 * "Locked" is the member the reader is, and the primary account. Neither can
 * have their role changed or be removed, so their row has no menu at all
 * rather than a menu of actions that silently fail.
 */
export function TeamMembersList({
  members,
  currentUserId,
}: TeamMembersListProps) {
  const router = useRouter();
  const t = useTranslations('user');
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();
  const [memberToDelete, setMemberToDelete] =
    useState<TeamMemberResponse | null>(null);

  const handleRoleChange = (member: TeamMemberResponse, role: UserRole) => {
    startTransition(async () => {
      const result = await updateUserRole(member.id, role);
      if (result.success) {
        toast.success(t('toast.roleUpdated'), {
          description: t('member.updatedDescription', {
            email: member.email,
            role: t(userRoleLabel(role)),
          }),
        });
        router.refresh();
      } else {
        // `error.message` rather than copy built from `error.fields`: the
        // server does name `role` here, but there is no react-hook-form on
        // this list to bind that to, and its own sentence ("Cannot demote
        // the last admin") is far more use in a toast than "Role is not
        // valid." would be.
        toast.error(t('toast.roleUpdateFailed'), {
          description: result.error.message,
        });
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!memberToDelete) return;
    const member = memberToDelete;
    startTransition(async () => {
      const result = await removeTeamMember(member.id);
      if (result.success) {
        toast.success(t('toast.removed'), { description: member.email });
        setMemberToDelete(null);
        router.refresh();
      } else {
        toast.error(t('toast.removeFailed'), {
          description: result.error.message,
        });
      }
    });
  };

  return (
    <SettingSection
      title={t('membersList.title')}
      description={t('membersList.description')}
    >
      {members.length === 0 ? (
        <SettingsEmpty
          icon={<TeamIcon size="2xl" />}
          title={t('membersList.empty')}
        />
      ) : (
        members.map((member) => {
          const isSelf = member.id === currentUserId;
          const locked = isSelf || member.is_primary === true;
          return (
            <SettingsListItem
              key={member.id}
              leading={<Avatar name={member.email} />}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {member.email}
                    {isSelf && (
                      <span className="font-normal text-fg-subtle">
                        {' '}
                        {t('table.you')}
                      </span>
                    )}
                  </span>
                  <Tag
                    variant="soft"
                    tone={member.role === 'admin' ? 'brand' : 'neutral'}
                  >
                    {t(userRoleLabel(member.role))}
                  </Tag>
                </span>
              }
              description={
                <>
                  {member.is_active ? t('table.active') : t('table.inactive')}
                  {' · '}
                  {member.last_login
                    ? t('table.lastLoginAt', {
                        date: format.dateTime(
                          new Date(member.last_login),
                          'date',
                        ),
                      })
                    : t('table.neverLoggedIn')}
                </>
              }
              actions={
                locked ? null : (
                  <Menu
                    align="end"
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={MoreIcon}
                        aria-label={t('table.actionsAria')}
                      />
                    }
                    actions={[
                      {
                        id: 'role',
                        label: t('table.changeRole'),
                        disabled: isPending,
                        items: USER_ROLES.map((role) => ({
                          id: role,
                          label: t(userRoleLabel(role)),
                          selected: member.role === role,
                          onSelect: () => {
                            if (role !== member.role) {
                              handleRoleChange(member, role);
                            }
                          },
                        })),
                      },
                      {
                        id: 'remove',
                        label: t('remove.confirm'),
                        icon: DeleteIcon,
                        tone: 'danger',
                        separated: true,
                        disabled: isPending,
                        onSelect: () => setMemberToDelete(member),
                      },
                    ]}
                  />
                )
              }
            />
          );
        })
      )}

      <AlertDialog
        open={memberToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('removeMember.title', { email: memberToDelete?.email ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('removeMember.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Spinner size="md" label={t('remove.removing')} />
                  {t('remove.removing')}
                </>
              ) : (
                t('remove.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingSection>
  );
}
