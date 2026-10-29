import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { Fragment, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/focus';
import { interactiveTransition } from '../../lib/motion';
import { tv } from '../../lib/tv';

/**
 * Where you are, and the way back: Issues / CHECKOUT-API-4F2.
 *
 * Two levels, three at most. This is not a file tree -- the sidebar already
 * says which section you are in, so the trail only has to bridge the gap
 * between a list and the record opened from it. A trail that needs four levels
 * is a navigation problem, not a breadcrumb problem.
 *
 * The last crumb is not a link: you are already there. Its
 * `aria-current="page"` is what tells a screen reader the same thing the
 * colour tells everyone else. A crumb that is an identifier -- an issue's
 * short id, a release -- says so with `mono`.
 */
const crumbs = tv({
  slots: {
    root: 'flex min-w-0 items-center gap-2 text-value font-medium',
    link: [
      'flex min-w-0 shrink items-center gap-2 truncate text-fg-subtle',
      'hover:text-fg-secondary',
      'rounded-xs',
      interactiveTransition,
      focusRing,
    ],
    /* An intermediate crumb with nowhere to go: the trail names the level but
       the level has no page of its own. Same colour as a link, minus every
       affordance that would promise one. */
    label: 'flex min-w-0 shrink items-center gap-2 truncate text-fg-subtle',
    current: 'flex min-w-0 items-center gap-2 truncate text-fg',
    separator: 'shrink-0 text-fg-disabled',
  },
  variants: {
    mono: { true: { current: 'font-mono text-mono' } },
  },
});

const styles = crumbs();

export interface Crumb {
  label: string;
  /** Drawn before the label: the project's tile on the first crumb. */
  icon?: ReactNode;
  /** The crumb is an identifier the system chose, set in mono. */
  mono?: boolean;
  /**
   * The element that navigates: `<Link to="/issues" />`. Omit it and the crumb
   * is drawn as plain text -- an `<a>` with no `href` is not a link, is not
   * reachable by tab, and announces as nothing.
   */
  render?: useRender.ComponentProps<'a'>['render'];
}

export interface BreadcrumbsProps {
  /** The trail, root first. The last one is the page you are on. */
  items: Crumb[];
  /** What sits between them. A slash, because a chevron says "expand". */
  separator?: ReactNode;
  className?: string;
  /** Names the trail for a screen reader. */
  label?: string;
}

function CrumbLink({ label, icon, render }: Crumb) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: styles.link(),
        children: (
          <>
            {icon}
            {label}
          </>
        ),
      },
      {},
    ),
  });
}

export function Breadcrumbs({
  items,
  separator = '/',
  className,
  label = 'Breadcrumb',
}: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={cn(styles.root(), className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;

        return (
          // A crumb is its place in the trail: two may share a label.
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
          <Fragment key={`${index}:${item.label}`}>
            {index > 0 ? (
              <span aria-hidden="true" className={styles.separator()}>
                {separator}
              </span>
            ) : null}

            {last ? (
              <span
                aria-current="page"
                className={crumbs({ mono: item.mono }).current()}
              >
                {item.icon}
                {item.label}
              </span>
            ) : item.render == null ? (
              <span className={styles.label()}>
                {item.icon}
                {item.label}
              </span>
            ) : (
              <CrumbLink {...item} />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

Breadcrumbs.displayName = 'Breadcrumbs';
