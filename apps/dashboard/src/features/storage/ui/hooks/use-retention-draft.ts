import type { CleanupStatus, RetentionSettings } from '@rustrak/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { storageMutations } from '@/features/storage/api/mutations';
import { storageQueries } from '@/features/storage/api/queries';
import { impactOf } from '@/features/storage/model/retention';

/**
 * Retention being edited: the draft, what it would delete (counted as it
 * changes), and saving it, at the next cleanup or now.
 */
export function useRetentionDraft(
  initial: RetentionSettings,
  /** With the cleanup started, `null` when none was asked for or it could not start. */
  onDone: (job: CleanupStatus | null) => void,
) {
  const t = useTranslations('storage');
  const [draft, setDraft] = useState(initial);
  const preview = useQuery(storageQueries.retentionPreview(draft));
  const update = useMutation(storageMutations.updateRetention());
  const run = useMutation(storageMutations.runRetention());

  // Starts the cleanup the saved settings now enforce; a failure to start is
  // said with a toast and still closes, the settings being saved.
  const startCleanup = () =>
    run.mutate(undefined, {
      onSuccess: onDone,
      onError: ({ error }) => {
        toast.error(t('toasts.cleanupFailed'), {
          description:
            error.kind === 'conflict' ? t('dialog.alreadyRunning') : undefined,
        });
        onDone(null);
      },
    });

  const save = (cleanNow: boolean) =>
    update.mutate(draft, {
      onError: () => toast.error(t('dialog.saveFailed')),
      onSuccess: () => {
        if (cleanNow) return startCleanup();
        toast.success(t('dialog.saved'));
        onDone(null);
      },
    });

  return {
    draft,
    setDraft,
    impact: impactOf(preview),
    retry: () => void preview.refetch(),
    isPending: update.isPending || run.isPending,
    save,
  };
}
