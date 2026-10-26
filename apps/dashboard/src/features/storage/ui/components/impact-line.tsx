import { SpinnerIcon } from '@rustrak/ui';
import { useTranslations } from 'use-intl';

/**
 * What a choice deletes, in one line: still counting, failed to count (with
 * a retry), nothing, or the sentence the caller gives.
 */
export function ImpactLine({
  state,
  sentence,
  nothing,
  onRetry,
}: {
  state: 'counting' | 'failed' | 'ready';
  /** What goes; `null` when nothing does. */
  sentence: string | null;
  nothing: string;
  onRetry: () => void;
}) {
  const t = useTranslations('storage');
  return (
    <p
      className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-value text-fg"
      aria-live="polite"
    >
      {state === 'failed' ? (
        <span className="text-danger-fg">
          {t('dialog.countFailed')}{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={onRetry}
          >
            {t('dialog.retry')}
          </button>
        </span>
      ) : state === 'counting' ? (
        <span className="flex items-center gap-2 text-fg-subtle">
          <SpinnerIcon
            size="sm"
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          {t('dialog.counting')}
        </span>
      ) : sentence ? (
        sentence
      ) : (
        <span className="text-fg-subtle">{nothing}</span>
      )}
    </p>
  );
}
