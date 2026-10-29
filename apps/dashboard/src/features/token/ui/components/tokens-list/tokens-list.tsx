import type { AuthTokenResponse } from '@rustrak/client';
import { Button, NewIcon, TokensIcon } from '@rustrak/ui';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import {
  createToken,
  deleteToken,
  getToken,
} from '@/features/token/api/mutations';
import { copyToClipboard } from '@/shared/lib/clipboard';
import {
  SettingSection,
  SettingsEmpty,
} from '@/shared/ui/components/setting-row';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';
import { useRouter } from '@/shared/ui/hooks/use-router';
import { CreateTokenDialog } from './create-token-dialog';
import { TokenRows } from './token-rows';

interface TokensListProps {
  initialTokens: AuthTokenResponse[];
  /** The page's header is drawn here: its action, "New token", is this list's. */
  title: string;
  subtitle: string;
  /** Under the list: where the API these tokens open is documented. */
  footer?: React.ReactNode;
}

export function TokensList({
  initialTokens,
  title,
  subtitle,
  footer,
}: TokensListProps) {
  const t = useTranslations('tokens');
  const commonT = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  // Which single token a request is in flight for, so only its own buttons go
  // quiet rather than the whole table.
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AuthTokenResponse | null>(
    null,
  );

  const closeCreate = () => {
    setIsCreateOpen(false);
    setNewToken(null);
    router.refresh();
  };

  const create = (description: string) => {
    startTransition(async () => {
      const result = await createToken({
        description: description || undefined,
      });

      if (!result.success) {
        toast.error(t('toasts.createFailed'), {
          description: result.error.message,
        });
        return;
      }

      setNewToken(result.data.token);
      toast.success(t('toasts.created'), {
        description: t('toasts.createdHint'),
      });
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setBusyId(id);
    setPendingDelete(null);

    startTransition(async () => {
      const result = await deleteToken(id);

      if (result.success) {
        toast.success(t('toasts.deleted'));
        router.refresh();
      } else {
        toast.error(t('toasts.deleteFailed'), {
          description: result.error.message,
        });
      }

      setBusyId(null);
    });
  };

  const copy = (token: AuthTokenResponse) => {
    setBusyId(token.id);
    startTransition(async () => {
      const result = await getToken(token.id);

      if (!result.success) {
        toast.error(t('toasts.getFailed'), {
          description: result.error.message,
        });
        setBusyId(null);
        return;
      }

      if (await copyToClipboard(result.data.token)) {
        toast.success(t('toasts.copied'));
      } else {
        // No clipboard (an insecure origin, usually). Showing the value is the
        // fallback: it is the one thing the user came here for.
        toast.info(t('toasts.copyTitle'), { description: result.data.token });
      }
      setBusyId(null);
    });
  };

  const copyNewToken = async () => {
    if (!newToken) return false;
    if (await copyToClipboard(newToken)) return true;

    toast.info(commonT('clipboardUnavailable'), {
      description: commonT('clipboardUnavailableHint'),
    });
    return false;
  };

  const rowProps = {
    tokens: initialTokens,
    isBusy: (token: AuthTokenResponse) => isPending || busyId === token.id,
    onCopy: copy,
    onDelete: setPendingDelete,
  };

  return (
    <>
      <SettingsHeader
        title={title}
        description={subtitle}
        actions={
          <CreateTokenDialog
            open={isCreateOpen}
            onOpenChange={(open) =>
              open ? setIsCreateOpen(true) : closeCreate()
            }
            newToken={newToken}
            isPending={isPending}
            onCreate={create}
            onDone={closeCreate}
            onCopyToken={copyNewToken}
          />
        }
      />

      <SettingSection
        title={t('list.title')}
        description={t('list.description')}
      >
        {initialTokens.length === 0 ? (
          <SettingsEmpty
            icon={<TokensIcon size="2xl" />}
            title={t('empty.title')}
            action={
              <Button icon={NewIcon} onClick={() => setIsCreateOpen(true)}>
                {t('empty.createFirst')}
              </Button>
            }
          />
        ) : (
          <TokenRows {...rowProps} />
        )}
      </SettingSection>

      {footer}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('deleteDialog.cancel')}
            </AlertDialogCancel>
            <Button
              variant="danger-primary"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending
                ? t('deleteDialog.deleting')
                : t('deleteDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
