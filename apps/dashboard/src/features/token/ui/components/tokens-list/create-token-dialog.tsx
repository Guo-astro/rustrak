import { Button, CopyIcon, Input, NewIcon, SelectedIcon } from '@rustrak/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/components/shadcn/dialog';

export const TOKEN_DESCRIPTION_MAX_LENGTH = 200;

/**
 * Creating a token, and then showing the one thing the server will not repeat
 * on demand in this shape: the full value, once.
 *
 * Two states in one dialog because they are two steps of one act. Closing
 * after the value is shown is what forgets it, which is why the caller gets
 * `onDone` rather than a plain `onOpenChange`.
 */
export function CreateTokenDialog({
  open,
  onOpenChange,
  newToken,
  isPending,
  onCreate,
  onDone,
  onCopyToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The full value, present only between creating it and closing the dialog. */
  newToken: string | null;
  isPending: boolean;
  onCreate: (description: string) => void;
  onDone: () => void;
  onCopyToken: () => Promise<boolean>;
}) {
  const t = useTranslations('tokens');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  const trimmed = description.trim();
  const isValid = trimmed.length <= TOKEN_DESCRIPTION_MAX_LENGTH;

  const create = () => {
    if (!isValid) return;
    onCreate(trimmed);
    setDescription('');
  };

  const copy = async () => {
    if (!(await onCopyToken())) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="primary" icon={NewIcon}>
            {t('create.trigger')}
          </Button>
        }
      />
      <DialogContent>
        {newToken ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('create.createdTitle')}</DialogTitle>
              <DialogDescription>
                {t('create.createdDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3">
                <code className="flex-1 break-all font-mono text-mono text-fg">
                  {newToken}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copied ? SelectedIcon : CopyIcon}
                  onClick={copy}
                  className="shrink-0"
                  aria-label={t('create.copyTokenLabel')}
                />
              </div>
              <p className="mt-2 text-hint text-fg-subtle">
                {t('create.copyAgainHint')}
              </p>
            </div>
            <DialogFooter>
              <Button variant="primary" onClick={onDone}>
                {t('create.done')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('create.title')}</DialogTitle>
              <DialogDescription>{t('create.description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="block text-value font-medium text-fg"
                >
                  {t('create.descriptionLabel')}
                </label>
                <Input
                  id="description"
                  placeholder={t('create.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && create()}
                  // Deliberately above the limit: the field accepts a little
                  // overshoot so the counter can say what is wrong, rather
                  // than silently swallowing keystrokes at the boundary.
                  maxLength={TOKEN_DESCRIPTION_MAX_LENGTH + 10}
                  invalid={!isValid}
                />
                <p className="text-hint text-fg-subtle">
                  {t('create.charCount', {
                    count: trimmed.length,
                    max: TOKEN_DESCRIPTION_MAX_LENGTH,
                  })}
                </p>
                {!isValid && (
                  <p className="text-meta text-danger-fg">
                    {t('create.descriptionTooLong', {
                      max: TOKEN_DESCRIPTION_MAX_LENGTH,
                    })}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t('create.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={create}
                disabled={isPending || !isValid}
              >
                {isPending ? t('create.creating') : t('create.submit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
