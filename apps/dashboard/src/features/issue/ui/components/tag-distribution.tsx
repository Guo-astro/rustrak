import type { TagSummary } from '@rustrak/client';
import { Text } from '@rustrak/ui';
import { useFormatter } from 'use-intl';

/** The top values, then whatever is left, in the chart palette's order. */
const SEGMENTS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3'] as const;

/**
 * How an issue spreads across each tag: the key, its leading value and that
 * value's share, and under it one bar split by the top three values --
 * enough to tell "only in production" from "everywhere" at a glance.
 *
 * Shares are of every event carrying the tag (`total_values`, Sentry's
 * `totalValues`), so the values the server leaves out of `top_values` are
 * the grey remainder rather than stretching the ones it lists to 100%.
 *
 * Each tag opens to its listed values and their shares: what a hover title
 * used to hold, reachable from the keyboard and readable on a phone.
 */
export function TagDistribution({ tags }: { tags: TagSummary[] }) {
  const format = useFormatter();
  // The app's named format: one decimal, so a share of 1 in 1,000 reads
  // 0.1%, not 0%.
  const percent = (value: number) => format.number(value, 'percent');

  return (
    <ul className="flex flex-col gap-3">
      {tags.map((tag) => {
        const listed = tag.top_values.reduce((sum, v) => sum + v.count, 0);
        // A server that predates the count sends fewer; never divide by less
        // than what is listed.
        const total = Math.max(tag.total_values, listed);
        const top = tag.top_values[0];
        const share = (count: number) => (total > 0 ? count / total : 0);

        return (
          <li key={tag.key}>
            <details className="group/tag">
              <summary className="flex cursor-pointer list-none flex-col gap-1.5 rounded-md [&::-webkit-details-marker]:hidden">
                <span className="flex items-baseline justify-between gap-3">
                  <Text variant="meta" tone="meta" truncate>
                    {tag.key}
                  </Text>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <Text
                      variant="mono-sm"
                      truncate
                      className="max-w-40 text-fg"
                    >
                      {top?.value ?? '–'}
                    </Text>
                    <Text variant="meta" tone="subtle" className="tabular-nums">
                      {percent(top ? share(top.count) : 0)}
                    </Text>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-1.5 overflow-hidden rounded-pill bg-surface-chip"
                >
                  {tag.top_values
                    .slice(0, SEGMENTS.length)
                    .map((value, index) => (
                      <span
                        key={value.value}
                        className={SEGMENTS[index]}
                        style={{ width: `${share(value.count) * 100}%` }}
                      />
                    ))}
                </span>
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {tag.top_values.map((value) => (
                  <li
                    key={value.value}
                    className="flex items-baseline justify-between gap-3"
                  >
                    {/* Opened to be read: the value wraps, never clips. */}
                    <Text
                      variant="mono-sm"
                      tone="subtle"
                      className="min-w-0 break-words"
                    >
                      {value.value}
                    </Text>
                    <Text variant="meta" tone="subtle" className="tabular-nums">
                      {percent(share(value.count))}
                    </Text>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
