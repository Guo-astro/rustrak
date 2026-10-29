import type { MonitorResponse } from '@rustrak/client';
import {
  Button,
  DeleteIcon,
  EditIcon,
  Menu,
  MoreIcon,
  MuteIcon,
  NotificationIcon,
} from '@rustrak/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { monitorMutations } from '@/features/monitor/api/mutations';
import { monitorHref } from '@/features/monitor/lib/href';
import { Link } from '@/shared/ui/components/link';
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

/**
 * Mute, the verb a failing monitor gets most, then edit, and delete behind
 * the menu with a confirmation.
 */
export function MonitorActions({
  projectId,
  monitor,
}: {
  projectId: number;
  monitor: MonitorResponse;
}) {
  const t = useTranslations('crons');
  const router = useRouter();
  const update = useMutation(monitorMutations.update(projectId));
  const del = useMutation(monitorMutations.delete(projectId, monitor.slug));
  const isPending = update.isPending || del.isPending;
  const [confirming, setConfirming] = useState(false);
  const base = `/projects/${projectId}/crons`;
  const href = monitorHref(projectId, monitor.slug);

  const toggleMute = () =>
    update.mutate(
      { slug: monitor.slug, body: { is_muted: !monitor.is_muted } },
      {
        onError: () => toast.error(t('actions.updateFailed')),
        onSuccess: () =>
          toast.success(
            t(monitor.is_muted ? 'actions.unmuted' : 'actions.muted'),
          ),
      },
    );

  const remove = () =>
    del.mutate(undefined, {
      onError: () => toast.error(t('actions.deleteFailed')),
      onSuccess: () => {
        toast.success(t('actions.deleted'));
        setConfirming(false);
        router.push(base);
      },
    });

  return (
    <div className="flex items-center gap-2">
      <Button
        icon={monitor.is_muted ? NotificationIcon : MuteIcon}
        disabled={isPending}
        onClick={toggleMute}
      >
        {t(monitor.is_muted ? 'actions.unmute' : 'actions.mute')}
      </Button>
      <Button icon={EditIcon} render={<Link href={`${href}/edit`} />}>
        {t('actions.edit')}
      </Button>
      <Menu
        align="end"
        trigger={
          <Button
            variant="ghost"
            icon={MoreIcon}
            aria-label={t('actions.more')}
            disabled={isPending}
          />
        }
        actions={[
          {
            id: 'delete',
            label: t('actions.delete'),
            icon: DeleteIcon,
            tone: 'danger',
            onSelect: () => setConfirming(true),
          },
        ]}
      />

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !open && !isPending && setConfirming(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('actions.deleteTitle', { monitor: monitor.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? t('actions.deleting') : t('actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
