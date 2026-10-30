import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

/**
 * What a route's `pendingComponent` wraps its skeleton in.
 *
 * The bars inside are `aria-hidden`; this is what tells a screen reader the
 * page is loading, once, instead of a pulse per bar. It draws no box of its
 * own (`display: contents`), so the skeleton inside lays out exactly as the
 * page it stands for: a settings page's header still sticks to the
 * layout's scroller, a list page still fills the sheet.
 */
export function PageLoading({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  return (
    <div role="status" aria-label={t('loading')} className="contents">
      {children}
    </div>
  );
}
