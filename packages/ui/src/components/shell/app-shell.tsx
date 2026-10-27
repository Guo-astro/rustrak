'use client';

import { type ReactNode, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { tv } from '../../lib/tv';
import type { IconComponent } from '../icon/icon';
import { TooltipProvider } from '../tooltip/tooltip';
import {
  SidebarProvider,
  type SidebarProviderProps,
  useSidebar,
} from './sidebar-context';

export interface AppShellProps
  extends Omit<SidebarProviderProps, 'children' | 'shortcutKey'> {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
  /** The shortcut that collapses the sidebar. `false` turns it off. */
  collapseShortcut?: string | false;
}

/**
 * The application frame: the sidebar on the canvas, and beside it the sheet
 * the pages sit on -- inset by 8 px, rounded, one step lighter. The page's own
 * `Topbar` goes at the top of the sheet, as its first child.
 *
 * The inset is the hierarchy. The canvas around the edge is the application;
 * the sheet is the page. Nothing else is needed to say which is which, so the
 * sidebar carries no border and no fill of its own.
 *
 * On a phone the sheet goes edge to edge: 8 px of frame on a 375 px screen is
 * 4 % of the width spent on a border.
 *
 * It occupies exactly the window and the only thing that scrolls is the
 * content. An error tracker is a place you spend the day jumping between a list
 * and a record, and having the navigation scroll away while you read down a
 * thousand events means scrolling back up to leave.
 *
 * `h-dvh` and not `h-screen`: on a phone the browser chrome appears and
 * disappears as you scroll, and with `vh` the last row of a list sits
 * permanently underneath it.
 *
 * It brings the tooltip provider with it, because the collapsed sidebar depends
 * on it: without a provider, running down a rail of seven icons means waiting
 * out the full delay seven times.
 */
export function AppShell({
  sidebar,
  children,
  className,
  collapseShortcut = 'b',
  ...sidebarState
}: AppShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider shortcutKey={collapseShortcut} {...sidebarState}>
        <div
          className={cn(
            'relative flex h-dvh overflow-hidden bg-canvas text-fg',
            className,
          )}
        >
          {sidebar}
          <DrawerScrim />

          <main
            className={cn(
              'flex min-w-0 flex-1 flex-col overflow-hidden bg-panel',
              'md:my-frame md:me-frame md:rounded-3xl',
              'md:border md:border-border-subtle',
            )}
          >
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

AppShell.displayName = 'AppShell';

/**
 * The dimmed backdrop behind the navigation drawer, on phones only.
 *
 * It does two jobs and both are needed: it dims the content so the navigation
 * reads as being on top of it, and it is the way out -- a tap outside closes,
 * which is what everyone tries before hunting for a cross. Escape does the same
 * for anyone on a keyboard.
 */
function DrawerScrim() {
  const { drawerOpen, setDrawerOpen } = useSidebar();

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, setDrawerOpen]);

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => setDrawerOpen(false)}
      data-open={drawerOpen || undefined}
      className={cn(
        'absolute inset-0 z-30 bg-scrim md:hidden',
        'transition-opacity duration-slow ease-standard',
        'not-data-open:pointer-events-none not-data-open:opacity-0',
      )}
    />
  );
}

export interface PageProps {
  children: ReactNode;
  className?: string;
  /**
   * The page scrolls as one. Off for a screen that owns its own scrolling --
   * a list with a sticky header and a pinned footer -- which is most of them.
   */
  scroll?: boolean;
}

/**
 * A page's content, with the system's 28 px gutter.
 *
 * When it scrolls it also takes focus, and that is not decoration: a logs
 * screen is sixty lines of text with nothing clickable in it, and a scrollable
 * box with no focusable content inside is unreachable with a keyboard --
 * there is literally no way to page down it. The cost is one extra tab stop
 * ahead of the content on pages that do have controls, which is the trade the
 * rule asks for and the one every code viewer makes.
 */
export function Page({ children, className, scroll = true }: PageProps) {
  return (
    <div
      tabIndex={scroll ? 0 : undefined}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4 p-page-gutter outline-none',
        scroll ? 'overflow-y-auto' : 'overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

Page.displayName = 'Page';

/** Tabs sit on the bottom rule, so only a header without them pads above it. */
const pageHeader = tv({
  base: 'shrink-0 border-b border-border-divider px-page-gutter pt-5.5',
  variants: {
    tabs: { true: '', false: 'pb-5' },
  },
});

export interface PageHeaderProps {
  title: ReactNode;
  /** The route's icon, in a tile beside the title. */
  icon?: IconComponent;
  /** A chip after the title: `142 unresolved`, `web@4.12.0 in production`. */
  meta?: ReactNode;
  /** One line under the title: what the page is. */
  description?: ReactNode;
  /** Pushed to the right, level with the title. */
  actions?: ReactNode;
  /** The page's tabs, under everything, sitting on the bottom rule. */
  tabs?: ReactNode;
  className?: string;
}

/**
 * A page's heading: what it is, what it holds, and what can be done to it.
 *
 * It runs the width of the sheet and ends on a rule, with the tabs sitting on
 * that rule, so the content below starts on a clean edge whatever the page
 * puts there. The icon is the same one as the route in the sidebar: it is
 * what ties the page you landed on to the row you clicked.
 */
export function PageHeader({
  title,
  icon: Icon,
  meta,
  description,
  actions,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <div className={pageHeader({ tabs: Boolean(tabs), className })}>
      <div className="flex items-center gap-3.5">
        {Icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-fg-secondary">
            <Icon size="2xl" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-title text-fg">{title}</h1>
            {meta ? (
              <span className="flex h-5.5 shrink-0 items-center gap-1.5 rounded-md bg-surface-hover px-2 text-meta text-fg-tertiary">
                {meta}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 truncate text-value text-fg-subtle">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </div>
  );
}

PageHeader.displayName = 'PageHeader';
