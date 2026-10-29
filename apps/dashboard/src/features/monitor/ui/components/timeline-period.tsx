import { TimeIcon } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import {
  TIMELINE_PERIODS,
  type TimelinePeriod,
} from '@/features/monitor/lib/timeline';
import { ScopeBar, ScopeSegment } from '@/shared/ui/components/scope-bar';

/** The window the strips span: a day, a week or a month back to now. */
export function TimelinePeriodFilter({
  period,
  onChange,
}: {
  period: TimelinePeriod;
  onChange: (period: TimelinePeriod) => void;
}) {
  const t = useTranslations('crons');
  return (
    <ScopeBar>
      <ScopeSegment
        icon={TimeIcon}
        label={period}
        actions={TIMELINE_PERIODS.map((value) => ({
          id: value,
          label: t(`periods.${value}`),
          selected: value === period,
          onSelect: () => onChange(value),
        }))}
      />
    </ScopeBar>
  );
}
