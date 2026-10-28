import { EnvironmentIcon, TimeIcon } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import { getProjectEnvironments } from '@/features/project/api/queries';
import {
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { scopeActions } from '@/shared/lib/scope-actions';
import { ScopeBar, ScopeSegment } from '@/shared/ui/components/scope-bar';
import { useAsync } from '@/shared/ui/hooks/use-async';

export interface ReleaseScope {
  environment?: string;
  period: PeriodChoice;
}

/**
 * What the releases pages count: one environment or all, over a window. The
 * list and a release share it, so opening a row keeps the slice it was read in.
 */
export function ReleaseFilters({
  projectId,
  scope,
  onChange,
}: {
  projectId: number;
  scope: ReleaseScope;
  onChange: (change: Partial<ReleaseScope>) => void;
}) {
  const t = useTranslations('projectPages.overview');
  const read = useAsync(() => getProjectEnvironments(projectId), [projectId]);
  const environments =
    read.state === 'ready' && read.data.success ? read.data.data : [];

  return (
    <ScopeBar>
      <ScopeSegment
        icon={EnvironmentIcon}
        label={scope.environment ?? t('environment')}
        active={scope.environment !== undefined}
        actions={scopeActions(
          environments,
          scope.environment,
          t('allEnvironments'),
          t('noEnvironments'),
          (environment) => onChange({ environment }),
        )}
      />
      <PeriodSegment
        period={scope.period}
        onChange={(period) => onChange({ period })}
      />
    </ScopeBar>
  );
}

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

function PeriodSegment({
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
