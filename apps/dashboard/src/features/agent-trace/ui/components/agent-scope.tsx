import { EnvironmentIcon, TimeIcon } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import { AGENT_PERIODS } from '@/features/agent-trace/model/filters';
import { scopeActions } from '@/shared/lib/scope-actions';
import { ScopeBar, ScopeSegment } from '@/shared/ui/components/scope-bar';

type AgentPeriod = (typeof AGENT_PERIODS)[number];

/** What every figure, chart and row of the agents pages counts. */
export function AgentScope({
  environments,
  environment,
  period,
  onChange,
}: {
  environments: string[];
  environment?: string;
  /** `undefined` is all time. */
  period?: AgentPeriod;
  onChange: (next: { environment?: string; period?: AgentPeriod }) => void;
}) {
  const t = useTranslations('agents.filters');
  return (
    <ScopeBar>
      <ScopeSegment
        icon={EnvironmentIcon}
        label={environment ?? t('environment')}
        active={environment !== undefined}
        mono={environment !== undefined}
        actions={scopeActions(
          environments,
          environment,
          t('allEnvironments'),
          t('noEnvironments'),
          (next) => onChange({ environment: next, period }),
        )}
      />
      <ScopeSegment
        icon={TimeIcon}
        label={period ?? t('allTimeShort')}
        actions={[
          ...AGENT_PERIODS.map((value) => ({
            id: value,
            label: t(`periods.${value}`),
            selected: value === period,
            onSelect: () => onChange({ environment, period: value }),
          })),
          {
            id: 'all',
            label: t('allTime'),
            selected: period === undefined,
            separated: true,
            onSelect: () => onChange({ environment, period: undefined }),
          },
        ]}
      />
    </ScopeBar>
  );
}
