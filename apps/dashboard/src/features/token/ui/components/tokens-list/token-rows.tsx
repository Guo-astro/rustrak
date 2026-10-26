import type { AuthTokenResponse } from '@rustrak/client';
import { TokensIcon } from '@rustrak/ui';
import { useFormatter, useTranslations } from 'use-intl';
import { SettingsListItem } from '@/shared/ui/components/setting-row';
import { TokenActions } from './token-actions';

export interface TokenListProps {
  tokens: AuthTokenResponse[];
  isBusy: (token: AuthTokenResponse) => boolean;
  onCopy: (token: AuthTokenResponse) => void;
  onDelete: (token: AuthTokenResponse) => void;
}

/**
 * One row per token: its name, the prefix it can be recognised by, when it
 * was made and last used, and its actions.
 *
 * The row is the same at every width. The facts on the right fold away on a
 * phone, and the created / last-used line under the name carries them there.
 */
export function TokenRows({
  tokens,
  isBusy,
  onCopy,
  onDelete,
}: TokenListProps) {
  const t = useTranslations('tokens');
  const format = useFormatter();

  return tokens.map((token) => {
    const created = t('createdOn', {
      date: format.dateTime(new Date(token.created_at), 'date'),
    });
    const used = token.last_used_at
      ? t('usedOn', { time: format.relativeTime(new Date(token.last_used_at)) })
      : t('neverUsed');

    return (
      <SettingsListItem
        key={token.id}
        leading={
          <span className="flex size-8 items-center justify-center rounded-lg border border-border-subtle text-fg-muted">
            <TokensIcon size="lg" />
          </span>
        }
        title={
          token.description || (
            <span className="font-mono text-mono">{token.token_prefix}…</span>
          )
        }
        description={
          <>
            <span className="font-mono text-mono-sm">
              {token.token_prefix}••••••••
            </span>
            <span className="sm:hidden">
              {' · '}
              {used}
            </span>
          </>
        }
        meta={
          <>
            <span>{created}</span>
            <span>{used}</span>
          </>
        }
        actions={
          <TokenActions
            token={token}
            busy={isBusy(token)}
            onCopy={onCopy}
            onDelete={onDelete}
          />
        }
      />
    );
  });
}
