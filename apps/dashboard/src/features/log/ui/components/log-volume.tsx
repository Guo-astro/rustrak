import type { LogsVolumeResponse } from '@rustrak/client';
import { BarsChart } from '@rustrak/ui';
import { useFormatter, useTranslations } from 'use-intl';
import { volumeBars } from '@/features/log/model/log-view';

/**
 * How many lines the search matches over the window, stacked by level: where
 * the list's lines sit in time, and whether the errors came in one burst.
 */
export function LogVolume({ points }: { points: LogsVolumeResponse }) {
  const t = useTranslations('logs');
  const format = useFormatter();
  const [first, second] = points;
  const daily =
    first && second
      ? Date.parse(second.bucket) - Date.parse(first.bucket) >= 86_400_000
      : false;

  return (
    <BarsChart
      data={volumeBars(points)}
      series={[
        { key: 'error', label: t('levels.error'), color: 'var(--sev-error)' },
        { key: 'warn', label: t('levels.warn'), color: 'var(--sev-warning)' },
        { key: 'info', label: t('levels.info'), color: 'var(--sev-info)' },
        { key: 'debug', label: t('levels.debug'), color: 'var(--chart-muted)' },
      ]}
      xKey="t"
      height={120}
      formatX={(value) =>
        format.dateTime(
          new Date(value),
          daily
            ? { month: 'short', day: 'numeric' }
            : { month: 'short', day: 'numeric', hour: 'numeric' },
        )
      }
      formatY={(value) => format.number(value, 'compact')}
      label={t('volume')}
    />
  );
}
