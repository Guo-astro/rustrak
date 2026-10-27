import type { InvitationResponse } from '@rustrak/client';
import {
  Avatar,
  Button,
  CloseIcon,
  CopyIcon,
  EmptyIcon,
  Tag,
} from '@rustrak/ui';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'use-intl';
import { revokeInvitation } from '@/features/user/api/mutations';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { type Translate } from '@/shared/lib/error-copy';
import {
  SettingSection,
  SettingsEmpty,
  SettingsListItem,
} from '@/shared/ui/components/setting-row';
import { useRouter } from '@/shared/ui/hooks/use-router';

interface PendingInvitationsProps {
  invitations: InvitationResponse[];
}

/**
 * Put an invite link on the clipboard, or show it when there is no clipboard.
 *
 * Module scope: it reads  and the invitation it is handed, and closes
 * over nothing in the component.
 */
async function handleCopy(invitation: InvitationResponse, t: Translate) {
  const link = `${window.location.origin}/invite/${invitation.token}`;
  if (await copyToClipboard(link)) {
    toast.success(t('toast.linkCopied'));
  } else {
    toast.info(t('toast.copyLink'), { description: link });
  }
}

export function PendingInvitations({ invitations }: PendingInvitationsProps) {
  const router = useRouter();
  const t = useTranslations('user');
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const handleRevoke = (invitation: InvitationResponse) => {
    startTransition(async () => {
      const result = await revokeInvitation(invitation.token);
      if (result.success) {
        toast.success(t('toast.revoked'));
        router.refresh();
      } else {
        // No form here, so there is no input to attach a `fields` entry to;
        // the message is what the row can show.
        toast.error(t('toast.revokeFailed'), {
          description: result.error.message,
        });
      }
    });
  };

  return (
    <SettingSection
      title={t('pending.title')}
      description={t('pending.description')}
    >
      {invitations.length === 0 ? (
        <SettingsEmpty
          icon={<EmptyIcon size="2xl" />}
          title={t('pending.empty')}
        />
      ) : (
        invitations.map((invitation) => (
          <SettingsListItem
            key={invitation.token}
            leading={<Avatar name={invitation.email} />}
            title={
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{invitation.email}</span>
                <Tag
                  variant="soft"
                  tone={invitation.role === 'admin' ? 'brand' : 'neutral'}
                >
                  {invitation.role === 'admin'
                    ? t('roles.admin')
                    : t('roles.member')}
                </Tag>
              </span>
            }
            description={t('pending.expires', {
              date: format.dateTime(new Date(invitation.expires_at), 'date'),
            })}
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={CopyIcon}
                  onClick={() => handleCopy(invitation, t)}
                  aria-label={t('pending.copyAria', {
                    email: invitation.email,
                  })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={CloseIcon}
                  onClick={() => handleRevoke(invitation)}
                  disabled={isPending}
                  aria-label={t('pending.revokeAria', {
                    email: invitation.email,
                  })}
                />
              </>
            }
          />
        ))
      )}
    </SettingSection>
  );
}
