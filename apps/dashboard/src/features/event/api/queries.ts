/**
 * Reads for the event feature. Events are only ever written by ingestion, so
 * there is no `mutations.ts` beside this.
 */
import type { EventResponse } from '@rustrak/client';
import { queryOptions } from '@tanstack/react-query';
import { projectScope } from '@/shared/api/keys';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

/** Where an event sits among its issue's events, 1-based for display. */
export interface EventNavigation {
  currentIndex: number;
  totalCount: number;
  firstEventId: string | null;
  lastEventId: string | null;
  prevEventId: string | null;
  nextEventId: string | null;
}

// Caps the sequential page reads of `navigation` to bound the worst-case
// round-trips for high-volume issues (~1000 events at PAGE_SIZE=20).
const MAX_NAV_PAGES = 50;

export const eventQueries = {
  all: (projectId: number) => [...projectScope(projectId), 'events'] as const,
  /** Every event read of one issue. */
  ofIssue: (projectId: number, issueId: string) =>
    [...eventQueries.all(projectId), 'issue', issueId] as const,
  /** One event with its full Sentry payload. */
  detail: (projectId: number, issueId: string, eventId: string) =>
    queryOptions({
      queryKey: [
        ...eventQueries.ofIssue(projectId, issueId),
        'detail',
        eventId,
      ],
      queryFn: ({ signal }) =>
        orThrow(
          api().events.get({
            path: {
              project_id: projectId,
              issue_id: issueId,
              event_id: eventId,
            },
            signal,
          }),
        ),
    }),
  /** The issue's most recent event, or `null` when it has none. */
  latest: (projectId: number, issueId: string) =>
    queryOptions({
      queryKey: [...eventQueries.ofIssue(projectId, issueId), 'latest'],
      queryFn: async ({ signal }): Promise<EventResponse | null> => {
        const page = await orThrow(
          api().events.list({
            path: { project_id: projectId, issue_id: issueId },
            query: { order: 'desc' },
            signal,
          }),
        );
        return page.items[0] ?? null;
      },
    }),
  /**
   * Prev/next/first/last around an event, walking the issue's events oldest
   * first (up to `MAX_NAV_PAGES` pages) and following the cursor chain.
   *
   * A page that *fails* fails the read rather than truncating the window,
   * because nothing downstream could tell a truncated window apart from a
   * genuinely short issue.
   *
   * A walk that merely *runs out of budget* still truncates, and that is a
   * known defect rather than a design: on hitting `MAX_NAV_PAGES` this answers
   * a partial `totalCount` and no signal. Because the issue page lands the
   * reader on the newest event while this walks ascending, the current event
   * usually falls outside a truncated window, `findIndex` returns `-1`, and the
   * result reads "0 of N" with "next" pointing at the oldest event. Recorded as
   * D-31 in deferred-work.md; the fix is a different navigation design (ask the
   * server for neighbours) rather than a bigger cap, which only moves the
   * threshold.
   */
  navigation: (projectId: number, issueId: string, eventId: string) =>
    queryOptions({
      queryKey: [
        ...eventQueries.ofIssue(projectId, issueId),
        'navigation',
        eventId,
      ],
      queryFn: async ({ signal }): Promise<EventNavigation> => {
        const events: EventResponse[] = [];
        let cursor: string | undefined;
        let pageCount = 0;
        do {
          const page = await orThrow(
            api().events.list({
              path: { project_id: projectId, issue_id: issueId },
              query: { order: 'asc', cursor },
              signal,
            }),
          );
          events.push(...page.items);
          cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
          pageCount++;
        } while (cursor && pageCount < MAX_NAV_PAGES);

        // An index past either end reads `undefined`, so no event, and an
        // event not in the window, both fall out as nulls and "0 of N".
        const index = events.findIndex((event) => event.id === eventId);
        return {
          currentIndex: index + 1,
          totalCount: events.length,
          firstEventId: events[0]?.id ?? null,
          lastEventId: events.at(-1)?.id ?? null,
          prevEventId: events[index - 1]?.id ?? null,
          nextEventId: events[index + 1]?.id ?? null,
        };
      },
    }),
  /** The files sent with an event, such as a feedback's screenshot. */
  attachments: (projectId: number, issueId: string, eventId: string) =>
    queryOptions({
      queryKey: [
        ...eventQueries.ofIssue(projectId, issueId),
        'attachments',
        eventId,
      ],
      queryFn: ({ signal }) =>
        orThrow(
          api().events.listAttachments({
            path: {
              project_id: projectId,
              issue_id: issueId,
              event_id: eventId,
            },
            signal,
          }),
        ),
    }),
  /** The event a Sentry SDK reported, by its 32-hex id, without its issue. */
  bySentryId: (projectId: number, eventId: string) =>
    queryOptions({
      queryKey: [...eventQueries.all(projectId), 'sentry-id', eventId],
      queryFn: ({ signal }) =>
        orThrow(
          api().events.getBySentryId({
            path: { project_id: projectId, event_id: eventId },
            signal,
          }),
        ),
    }),
};
