import { TimeIcon } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import {
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { ScopeBar, ScopeSegment } from '@/shared/ui/components/scope-bar';

/** The window alone, beside the list's query bar. */
export function PeriodFilter(props: {
  period: PeriodChoice;
  onChange: (period: PeriodChoice) => void;
}) {
  return (
    <ScopeBar>
      <PeriodSegment {...props} />
    </ScopeBar>
  );
}

export function PeriodSegment({
  period,
  onChange,
}: {
  period: PeriodChoice;
  onChange: (period: PeriodChoice) => void;
}) {
  const t = useTranslations('projectPages.overview');
  return (
    <ScopeSegment
      icon={TimeIcon}
      label={period === 'all' ? t('periods.allShort') : period}
      actions={PERIOD_CHOICES.map((value) => ({
        id: value,
        label: t(`periods.${value}`),
        selected: value === period,
        separated: value === 'all',
        onSelect: () => onChange(value),
      }))}
    />
  );
}
