import type {
  ProjectMemberResponse,
  ProjectRole,
  TeamMemberResponse,
} from '@rustrak/client';
import {
  Avatar,
  Button,
  DeleteIcon,
  Menu,
  MoreIcon,
  NewIcon,
  Tag,
  TeamIcon,
} from '@rustrak/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { userMutations } from '@/features/user/api/mutations';
import { userQueries } from '@/features/user/api/queries';
import { PROJECT_ROLES, roleLabel } from '@/features/user/model/roles';
import {
  SettingSection,
  SettingsEmpty,
  SettingsListItem,
} from '@/shared/ui/components/setting-row';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/components/shadcn/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';

interface MembersSettingsProps {
  projectId: number;
  members: ProjectMemberResponse[];
  currentUserId?: number;
  canManage: boolean;
}

export function MembersSettings({
  projectId,
  members,
  currentUserId,
  canManage,
}: MembersSettingsProps) {
  const t = useTranslations('user');
  const upsert = useMutation(userMutations.upsertMember(projectId));
  const remove = useMutation(userMutations.removeMember(projectId));
  const isPending = upsert.isPending || remove.isPending;
  // Only a manager sees the add-member dropdown it populates.
  const team = useQuery({ ...userQueries.team(), enabled: canManage });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [removingMember, setRemovingMember] =
    useState<ProjectMemberResponse | null>(null);

  const memberIds = new Set(members.map((m) => m.user_id));
  // Exclude users who are already members, and global admins — admins (including
  // the primary user) already have implicit access to every project, so adding
  // them as a project member is meaningless.
  const availableUsers = (team.data ?? []).filter(
    (user) => !memberIds.has(user.id) && user.role !== 'admin',
  );

  const handleRoleChange = (
    member: ProjectMemberResponse,
    role: ProjectRole,
  ) => {
    if (role === member.role) return;
    upsert.mutate(
      { user_id: member.user_id, role },
      {
        onSuccess: () =>
          toast.success(t('toast.updated'), {
            description: t('member.updatedDescription', {
              email: member.email,
              role: t(roleLabel(role)),
            }),
          }),
        // `error.message` rather than copy built from `error.fields`: the
        // server names `role`, but these are row menu actions, not a
        // react-hook-form, and the server's own sentence ("Cannot downgrade
        // the last project admin") says far more than the generic field copy.
        onError: (error) =>
          toast.error(t('toast.updateFailed'), {
            description: error.error.message,
          }),
      },
    );
  };

  const handleRemove = () => {
    if (!removingMember) return;
    remove.mutate(removingMember.user_id, {
      onSuccess: () => {
        toast.success(t('toast.removed'));
        setRemovingMember(null);
      },
      onError: (error) =>
        toast.error(t('toast.removeFailed'), {
          description: error.error.message,
        }),
    });
  };

  return (
    <>
      <SettingsHeader
        title={t('members.title')}
        description={
          canManage
            ? t('members.manageDescription')
            : t('members.readOnlyDescription')
        }
        actions={
          canManage ? (
            <Button
              variant="primary"
              icon={NewIcon}
              onClick={() => setShowAddDialog(true)}
            >
              {t('members.addMember')}
            </Button>
          ) : null
        }
      />

      <SettingSection title={t('membersList.title')}>
        {members.length === 0 ? (
          <SettingsEmpty
            icon={<TeamIcon size="2xl" />}
            title={t('members.empty')}
          />
        ) : (
          // The ⋯ menu exists only when the reader can manage members: a
          // menu that is absent rather than one full of disabled actions.
          members.map((member) => (
            <SettingsListItem
              key={member.user_id}
              leading={<Avatar name={member.email} />}
              // The role sits beside the name rather than in `meta`, which
              // hides below `sm`: on a phone it is the row's one fact.
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {member.email}
                    {member.user_id === currentUserId && (
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
                    {t(roleLabel(member.role))}
                  </Tag>
                </span>
              }
              actions={
                canManage ? (
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
                        items: PROJECT_ROLES.map((entry) => ({
                          id: entry.value,
                          label: t(entry.labelKey),
                          selected: member.role === entry.value,
                          onSelect: () => handleRoleChange(member, entry.value),
                        })),
                      },
                      {
                        id: 'remove',
                        label: t('remove.confirm'),
                        icon: DeleteIcon,
                        tone: 'danger',
                        separated: true,
                        disabled: isPending,
                        onSelect: () => setRemovingMember(member),
                      },
                    ]}
                  />
                ) : null
              }
            />
          ))
        )}
      </SettingSection>

      <AddMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        availableUsers={availableUsers}
        // An empty dropdown reading "No users available" is a claim about the
        // team; a failed read gives no basis to make it.
        teamFailed={team.isError}
        onSuccess={() => setShowAddDialog(false)}
      />

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('remove.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('remove.description', {
                email: removingMember?.email ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? t('remove.removing') : t('remove.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Add Member Dialog
// ============================================================================

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  availableUsers: TeamMemberResponse[];
  /** The team list could not be read, so the dropdown is empty for a reason. */
  teamFailed: boolean;
  onSuccess: () => void;
}

function AddMemberDialog({
  open,
  onOpenChange,
  ...formProps
}: AddMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AddMemberForm onOpenChange={onOpenChange} {...formProps} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog body, and the only owner of the draft member.
 *
 * It lives inside `DialogContent` rather than beside it because Base UI
 * unmounts the portal once the close animation finishes. Mounting is
 * therefore the reset: every open starts from a fresh `userId` and `role`
 * with no effect clearing them, and the previous draft stays on screen
 * while the dialog animates away instead of blanking mid-flight.
 */
function AddMemberForm({
  onOpenChange,
  projectId,
  availableUsers,
  teamFailed,
  onSuccess,
}: Omit<AddMemberDialogProps, 'open'>) {
  const t = useTranslations('user');
  const add = useMutation(userMutations.upsertMember(projectId));
  const isPending = add.isPending;
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('viewer');

  const handleAdd = () => {
    const parsedId = Number.parseInt(userId, 10);
    if (!Number.isFinite(parsedId)) return;
    add.mutate(
      { user_id: parsedId, role },
      {
        onSuccess: () => {
          toast.success(t('toast.added'));
          onSuccess();
        },
        onError: (error) =>
          toast.error(t('toast.addFailed'), {
            description: error.error.message,
          }),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('addMember.title')}</DialogTitle>
        <DialogDescription>{t('addMember.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-1">
        <div className="space-y-1.5">
          <label htmlFor="add-member-user" className="text-label text-fg-muted">
            {t('addMember.userLabel')}
          </label>
          <Select
            value={userId}
            onValueChange={(value) => setUserId(value ?? '')}
            disabled={isPending || availableUsers.length === 0}
          >
            <SelectTrigger
              id="add-member-user"
              className="w-full"
              aria-label={t('addMember.userAria')}
            >
              <SelectValue
                placeholder={
                  teamFailed
                    ? t('addMember.teamFailed')
                    : availableUsers.length === 0
                      ? t('addMember.noUsers')
                      : t('addMember.selectUser')
                }
              >
                {(value) =>
                  availableUsers.find((u) => String(u.id) === value)?.email ??
                  ''
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="add-member-role" className="text-label text-fg-muted">
            {t('addMember.roleLabel')}
          </label>
          <Select
            value={role}
            onValueChange={(value) => {
              if (value) setRole(value as ProjectRole);
            }}
            disabled={isPending}
          >
            <SelectTrigger
              id="add-member-role"
              className="w-full"
              aria-label={t('addMember.roleAria')}
            >
              <SelectValue>
                {(value) => t(roleLabel(value as ProjectRole))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROJECT_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button
          variant="primary"
          icon={NewIcon}
          loading={isPending}
          onClick={handleAdd}
          disabled={!userId}
        >
          {t('addMember.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}
