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
 * Shares are of the values listed, not of every occurrence: the server
 * returns the top values only, and the remainder is drawn as grey.
 */
export function TagDistribution({ tags }: { tags: TagSummary[] }) {
  const format = useFormatter();

  return (
    <ul className="flex flex-col gap-3">
      {tags.map((tag) => {
        const total = tag.top_values.reduce((sum, v) => sum + v.count, 0);
        const top = tag.top_values[0];
        const share = (count: number) => (total > 0 ? count / total : 0);

        return (
          <li key={tag.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Text variant="meta" tone="meta" truncate>
                {tag.key}
              </Text>
              <span className="flex min-w-0 items-baseline gap-2">
                <Text variant="mono-sm" truncate className="max-w-40 text-fg">
                  {top?.value ?? '–'}
                </Text>
                <Text variant="meta" tone="subtle" className="tabular-nums">
                  {format.number(top ? share(top.count) : 0, {
                    style: 'percent',
                  })}
                </Text>
              </span>
            </div>
            <div
              className="flex h-1.5 overflow-hidden rounded-pill bg-surface-chip"
              title={tag.top_values
                .map(
                  (v) =>
                    `${v.value}: ${format.number(share(v.count), { style: 'percent' })}`,
                )
                .join('\n')}
            >
              {tag.top_values.slice(0, SEGMENTS.length).map((value, index) => (
                <span
                  key={value.value}
                  className={SEGMENTS[index]}
                  style={{ width: `${share(value.count) * 100}%` }}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
