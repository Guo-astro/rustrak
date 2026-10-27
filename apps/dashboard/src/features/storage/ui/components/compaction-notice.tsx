import type { CleanupStatus, Compaction } from '@rustrak/client';
import { Button, StorageIcon } from '@rustrak/ui';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { compactStorage } from '@/features/storage/api/mutations';
import { getStorageCompaction } from '@/features/storage/api/queries';
import { formatBytes } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';

/**
 * A row in the storage page's retention section, shown only on a SQLite file created before incremental mode, which never
 * gives deleted data's space back to the disk: says how much it holds and
 * compacts it once, behind a dialog that prices the disk and the pause.
 * Read again with the rest of the page, so it goes once compacted.
 */
export function CompactionNotice({
  disabled,
  onStarted,
}: {
  /** A cleanup or compaction is running. */
  disabled: boolean;
  onStarted: (job: CleanupStatus) => void;
}) {
  const t = useTranslations('storage');
  const [compaction, setCompaction] = useState<Compaction | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Hidden while a job runs and read again once it stops: a compaction that
  // just finished must not leave its button up, and a cleanup changes what
  // there is to give back.
  useEffect(() => {
    if (disabled) {
      setCompaction(null);
      return;
    }
    let cancelled = false;
    getStorageCompaction().then((result) => {
      if (!cancelled && result.success) setCompaction(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  if (!compaction?.needed) return null;

  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-border-divider px-5 py-4 last:border-b-0">
      <StorageIcon
        size="lg"
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-fg-muted"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-value font-medium text-fg">
          {t('compaction.title')}
        </p>
        <p className="max-w-2xl text-hint text-fg-subtle">
          {t('compaction.description', {
            size: formatBytes(compaction.reclaimable_bytes),
          })}
        </p>
      </div>
      <Button onClick={() => setConfirming(true)} disabled={disabled}>
        {t('compaction.action')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        compaction={compaction}
        onStarted={onStarted}
      />
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  compaction,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compaction: Compaction;
  onStarted: (job: CleanupStatus) => void;
}) {
  const t = useTranslations('storage');
  const [isPending, startTransition] = useTransition();
  const free = compaction.free_disk_bytes;
  const room = free === null || free >= compaction.required_disk_bytes;

  const run = () =>
    startTransition(async () => {
      const result = await compactStorage();
      if (result.success) {
        onStarted(result.data);
        onOpenChange(false);
        return;
      }
      toast.error(t('toasts.compactionFailed'), {
        description:
          result.error.kind === 'conflict'
            ? t('dialog.alreadyRunning')
            : result.error.message,
      });
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !isPending && onOpenChange(o)}
    >
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('compaction.dialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('compaction.dialogDescription', {
              size: formatBytes(compaction.reclaimable_bytes),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1.5 pl-5 text-value text-fg">
          <li className={room ? undefined : 'text-danger-fg'}>
            {free === null
              ? t('compaction.diskUnknown', {
                  required: formatBytes(compaction.required_disk_bytes),
                })
              : t('compaction.disk', {
                  required: formatBytes(compaction.required_disk_bytes),
                  free: formatBytes(free),
                })}
          </li>
          <li>{t('compaction.pause')}</li>
          <li>{t('compaction.duration')}</li>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('cancel')}
          </AlertDialogCancel>
          <Button
            variant="primary"
            onClick={run}
            loading={isPending}
            disabled={!room}
          >
            {t('compaction.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
