import { EnvironmentIcon } from '@rustrak/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'use-intl';
import { projectQueries } from '@/features/project/api/queries';
import type { PeriodChoice } from '@/features/release/model/session-health';
import { PeriodSegment } from '@/features/release/ui/components/period-filter';
import { scopeActions } from '@/shared/lib/scope-actions';
import { ScopeBar, ScopeSegment } from '@/shared/ui/components/scope-bar';

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
  // No choices while they load or when they fail to: the filter still works.
  const environments =
    useQuery(projectQueries.environments(projectId)).data ?? [];

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
