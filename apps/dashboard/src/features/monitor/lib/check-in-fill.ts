import type { CheckInStatus } from '@rustrak/client';
import { cn } from '@/shared/lib/utils';
import type { TickStatus } from './timeline';

/**
 * A diagonal hatch over a fill, for the two statuses the server inferred
 * rather than the job reported: a reader must tell a timeout from a failure
 * without telling red from red (Sentry's `getTickStyle`).
 */
const HATCH =
  '[background-image:repeating-linear-gradient(135deg,transparent_0_2px,rgb(255_255_255/0.45)_2px_4px)]';

const FILL: Record<CheckInStatus | TickStatus, string> = {
  ok: 'bg-success',
  error: 'bg-sev-error',
  timeout: cn('bg-sev-error', HATCH),
  missed: 'bg-sev-warning',
  in_progress: 'bg-fg-ghost animate-pulse',
  unknown: cn('bg-fg-ghost', HATCH),
  empty: 'bg-border',
};

/** The fill of one check-in, as a tick on a timeline or a status dot. */
export function checkInFill(status: CheckInStatus | TickStatus): string {
  return FILL[status];
}
