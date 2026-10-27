import type { AuthTokenResponse } from '@rustrak/client';
import {
  CopyIcon,
  cn,
  DeleteIcon,
  focusRing,
  interactiveTransition,
  Menu,
  MoreIcon,
} from '@rustrak/ui';
import { useTranslations } from 'use-intl';

/**
 * Copy and delete for one token, behind the row's ⋯ menu.
 *
 * A token is identified by its description where it has one and by its
 * prefix otherwise, and that fallback is the whole reason these actions need
 * labels: "copy" and "delete" alone never say what.
 */
export function TokenActions({
  token,
  busy,
  onCopy,
  onDelete,
}: {
  token: AuthTokenResponse;
  busy: boolean;
  onCopy: (token: AuthTokenResponse) => void;
  onDelete: (token: AuthTokenResponse) => void;
}) {
  const t = useTranslations('tokens');
  const label = token.description || token.token_prefix;

  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          disabled={busy}
          aria-label={t('actionsLabel')}
          className={cn(
            'flex size-control-xs items-center justify-center rounded-md text-fg-meta',
            'hover:bg-surface-hover hover:text-fg disabled:opacity-30',
            'data-popup-open:bg-surface-hover',
            interactiveTransition,
            focusRing,
          )}
        >
          <MoreIcon size="lg" />
        </button>
      }
      actions={[
        {
          id: 'copy',
          label: t('copyTokenLabel', { label }),
          icon: CopyIcon,
          disabled: busy,
          onSelect: () => onCopy(token),
        },
        {
          id: 'delete',
          label: t('deleteTokenLabel', { label }),
          icon: DeleteIcon,
          tone: 'danger',
          separated: true,
          disabled: busy,
          onSelect: () => onDelete(token),
        },
      ]}
    />
  );
}
