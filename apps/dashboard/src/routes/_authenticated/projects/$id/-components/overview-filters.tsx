import { EnvironmentIcon, ReleaseIcon, TimeIcon } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import {
  getProjectEnvironments,
  getProjectReleases,
} from '@/features/project/api/queries';
import {
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { scopeActions } from '@/shared/lib/scope-actions';
import { ScopeBar, ScopeSegment } from '@/shared/ui/components/scope-bar';
import { useAsync } from '@/shared/ui/hooks/use-async';

export interface FilterChange {
  period?: PeriodChoice;
  environment?: string;
  release?: string;
}

interface OverviewFiltersProps {
  projectId: number;
  period: PeriodChoice;
  environment?: string;
  release?: string;
  onChange: (change: FilterChange) => void;
}

/**
 * The page's filters, in its header: they scope every panel below at once,
 * which is what sets them apart from a table's own filters, that live with
 * the table.
 *
 * One joined bar rather than three buttons, so it reads as one control that
 * says what slice of the project you are looking at. Weight follows meaning:
 * a scope that is not set shows only its name, quietly; one that is set
 * shows its value, bright, with the brand dot. Held in the URL, so a filtered
 * view survives a reload and a shared link.
 */
export function OverviewFilters({
  projectId,
  period,
  environment,
  release,
  onChange,
}: OverviewFiltersProps) {
  const t = useTranslations('projectPages.overview');
  const environments = useOptions(getProjectEnvironments, projectId);
  const releases = useOptions(getProjectReleases, projectId);

  return (
    <ScopeBar>
      <ScopeSegment
        icon={EnvironmentIcon}
        label={environment ?? t('environment')}
        active={environment !== undefined}
        actions={scopeActions(
          environments,
          environment,
          t('allEnvironments'),
          t('noEnvironments'),
          (value) => onChange({ environment: value }),
        )}
      />
      <ScopeSegment
        icon={ReleaseIcon}
        label={release ?? t('release')}
        active={release !== undefined}
        mono={release !== undefined}
        actions={scopeActions(
          releases,
          release,
          t('allReleases'),
          t('noReleases'),
          (value) => onChange({ release: value }),
        )}
      />
      <ScopeSegment
        icon={TimeIcon}
        // The short form: the menu spells it out.
        label={period === 'all' ? t('periods.allShort') : period}
        actions={PERIOD_CHOICES.map((value) => ({
          id: value,
          label: t(`periods.${value}`),
          selected: value === period,
          // All time stands apart: it is the one with nothing to compare to.
          separated: value === 'all',
          onSelect: () => onChange({ period: value }),
        }))}
      />
    </ScopeBar>
  );
}

/** A filter's choices, empty while they load or when they fail to. */
function useOptions(
  load: (projectId: number) => Promise<{ success: boolean; data?: string[] }>,
  projectId: number,
): string[] {
  const read = useAsync(() => load(projectId), [projectId]);
  return read.state === 'ready' && read.data.success
    ? (read.data.data ?? [])
    : [];
}
