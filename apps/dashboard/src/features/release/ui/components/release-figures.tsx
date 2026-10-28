import { cn } from '@rustrak/ui';
import { useFormatter } from 'use-intl';
import {
  healthTone,
  splitVersion,
} from '@/features/release/model/session-health';

const TONE_TEXT = {
  good: 'text-success-fg',
  warning: 'text-sev-warning-fg',
  bad: 'text-sev-error-fg',
} as const;

/**
 * A crash-free rate, coloured by how it reads; a dash with no sessions.
 * `quiet`, for a column of them, colours only the ones that need a look.
 */
export function HealthRate({
  rate,
  quiet,
  className,
}: {
  rate: number | null | undefined;
  quiet?: boolean;
  className?: string;
}) {
  const format = useFormatter();
  const tone = healthTone(rate);
  return (
    <span
      className={cn(
        'tabular-nums',
        tone === null
          ? 'text-fg-ghost'
          : quiet && tone === 'good'
            ? 'text-fg-secondary'
            : TONE_TEXT[tone],
        className,
      )}
    >
      {rate == null
        ? '–'
        : format.number(rate, { style: 'percent', maximumFractionDigits: 2 })}
    </span>
  );
}

/** A release's share of the sessions, as a bar and its percentage. */
export function AdoptionBar({ adoption }: { adoption: number | null }) {
  const format = useFormatter();
  if (adoption == null) return <span className="text-fg-ghost">–</span>;
  return (
    <span className="flex w-full items-center gap-2">
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-chip">
        <span
          className="block h-full rounded-pill bg-chart-1"
          style={{ width: `${Math.max(adoption * 100, 2)}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-fg-secondary text-meta tabular-nums">
        {format.number(adoption, {
          style: 'percent',
          maximumFractionDigits: 0,
        })}
      </span>
    </span>
  );
}

/** The version the reader scans for, after the package they already know. */
export function VersionName({
  version,
  className,
}: {
  version: string;
  className?: string;
}) {
  const parts = splitVersion(version);
  return (
    <span className={cn('min-w-0 truncate font-mono', className)}>
      {parts.package ? (
        <span className="text-fg-subtle">{parts.package}@</span>
      ) : null}
      <span className="text-fg">{parts.version}</span>
    </span>
  );
}
