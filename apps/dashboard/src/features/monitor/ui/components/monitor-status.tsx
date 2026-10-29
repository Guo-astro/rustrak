import type { MonitorResponse } from '@rustrak/client';
import { MuteIcon, Tag, type TagTone } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import {
  type MonitorHealth,
  monitorHealth,
} from '@/features/monitor/lib/status';

const TONE: Record<MonitorHealth, TagTone> = {
  failing: 'error',
  ok: 'brand',
  waiting: 'neutral',
};

/** The monitor's health spelled out, and whether it is muted. */
export function MonitorStatus({ monitor }: { monitor: MonitorResponse }) {
  const t = useTranslations('crons');
  const health = monitorHealth(monitor);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Tag variant="soft" tone={TONE[health]}>
        {t(`health.${health}`)}
      </Tag>
      {monitor.is_muted ? (
        <Tag variant="soft" tone="neutral" className="gap-1">
          <MuteIcon size="sm" aria-hidden="true" />
          {t('health.muted')}
        </Tag>
      ) : null}
    </span>
  );
}
