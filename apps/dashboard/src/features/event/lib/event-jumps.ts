import type { readEventPayload } from '@/features/event/lib/event-payload';

/** The "does this event have anything to show here?" flags. */
export type EventJumpFlags = ReturnType<typeof readEventPayload>['has'];

/** An anchor the "jump to" strip can offer. */
export type EventJumpTarget =
  | 'highlights'
  | 'stacktrace'
  | 'breadcrumbs'
  | 'tags'
  | 'context';

/**
 * The sections this event actually has, in render order.
 *
 * An anchor to a section that is not on the page is worse than no anchor: it
 * scrolls nowhere and reads as a broken page rather than as an event that
 * simply carried no breadcrumbs.
 */
export function eventJumpTargets(has: EventJumpFlags): EventJumpTarget[] {
  const targets: EventJumpTarget[] = ['highlights'];

  if (has.stackTrace) targets.push('stacktrace');
  if (has.breadcrumbs) targets.push('breadcrumbs');
  if (has.tags) targets.push('tags');

  // One anchor for three panels: contexts, modules and the user render
  // together under a single heading.
  if (has.contexts || has.modules || has.user) targets.push('context');

  return targets;
}

/**
 * The section being read: the last one whose top has scrolled past `line`
 * (the bottom edge of the sticky bar), or the first one before any has.
 *
 * At the very end of the page the last section wins even if its top never
 * reached the line -- a short final section would otherwise never light up.
 */
export function sectionInView<TId extends string>(
  tops: { id: TId; top: number }[],
  line: number,
  atEnd = false,
): TId | undefined {
  if (atEnd) return tops.at(-1)?.id;
  let current = tops[0]?.id;
  for (const { id, top } of tops) {
    if (top <= line) current = id;
  }
  return current;
}
