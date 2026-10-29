import type { CleanupCounts, ProjectStorage } from '@rustrak/client';
import { Button } from '@rustrak/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import {
  estimateBytes,
  impactState,
  removedParts,
} from '@/features/storage/model/retention';
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
import { DialogFooter } from '@/shared/ui/components/shadcn/dialog';
import { ImpactLine } from './impact-line';

/**
 * What a retention draft deletes, and its three ways out: cancel, save for
 * the next cleanup, or save and clean up now (asked once more).
 */
export function RetentionFooter({
  impact,
  onRetry,
  projects,
  isPending,
  onCancel,
  onSave,
}: {
  impact: CleanupCounts | null | 'failed';
  /** Asks for the count again after it failed. */
  onRetry: () => void;
  projects: readonly ProjectStorage[];
  isPending: boolean;
  onCancel: () => void;
  onSave: (cleanNow: boolean) => void;
}) {
  const t = useTranslations('storage');
  const [confirming, setConfirming] = useState(false);
  const known = impact === null || impact === 'failed' ? null : impact;
  const parts = known ? removedParts(known, t) : [];
  const size = known ? formatBytes(estimateBytes(known, projects)) : '';

  return (
    <>
      <ImpactLine
        state={impactState(impact)}
        sentence={
          parts.length > 0
            ? t('dialog.impact', { parts: parts.join(', '), size })
            : null
        }
        nothing={t('dialog.noImpact')}
        onRetry={onRetry}
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button
          onClick={() => setConfirming(true)}
          disabled={isPending || parts.length === 0}
        >
          {t('dialog.saveAndClean')}
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(false)}
          disabled={isPending}
          loading={isPending && !confirming}
        >
          {t('dialog.save')}
        </Button>
      </DialogFooter>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !isPending && setConfirming(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dialog.confirmTitle', { size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialog.confirmDescription', { parts: parts.join(', ') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <Button
              variant="danger-primary"
              onClick={() => onSave(true)}
              loading={isPending}
            >
              {t('dialog.confirmAction', { size })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
