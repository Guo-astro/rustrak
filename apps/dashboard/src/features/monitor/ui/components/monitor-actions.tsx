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
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { deleteMonitor, updateMonitor } from '@/features/monitor/api/mutations';
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
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const base = `/projects/${projectId}/crons`;
  const href = monitorHref(projectId, monitor.slug);

  const toggleMute = () =>
    startTransition(async () => {
      const result = await updateMonitor(projectId, monitor.slug, {
        is_muted: !monitor.is_muted,
      });
      if (!result.success) {
        toast.error(t('actions.updateFailed'));
        return;
      }
      toast.success(t(monitor.is_muted ? 'actions.unmuted' : 'actions.muted'));
      await router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteMonitor(projectId, monitor.slug);
      if (!result.success) {
        toast.error(t('actions.deleteFailed'));
        return;
      }
      toast.success(t('actions.deleted'));
      setConfirming(false);
      router.push(base);
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
