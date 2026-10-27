import type { ReactNode } from 'react';

/**
 * A settings page's title and what it is for.
 *
 * The same reading as `PageHeader` -- title, one quiet line under it, a rule
 * -- but it lives inside the page's scroller and sticks to its top, bleeding
 * over the scroller's padding, because a settings page is a route's child and
 * cannot sit outside the layout's `Page` the way a top-level page does.
 *
 * The negative `top` is not a typo: a sticky box sticks inside its scroller's
 * padding, so `top-0` would hold it a gutter below the sheet's edge.
 */
export function SettingsHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="settings-header sticky -top-page-gutter z-20 -mx-page-gutter -mt-page-gutter mb-2 flex items-start justify-between gap-6 border-b border-border-divider bg-panel px-page-gutter pt-7 pb-6">
      <div className="min-w-0">
        <h1 className="truncate text-page-title text-fg">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-value text-fg-subtle">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
