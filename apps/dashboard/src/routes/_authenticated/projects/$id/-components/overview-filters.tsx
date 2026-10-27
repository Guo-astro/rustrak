import {
  ChevronDownIcon,
  cn,
  EnvironmentIcon,
  focusRing,
  type IconComponent,
  interactiveTransition,
  Menu,
  type MenuAction,
  ReleaseIcon,
  TimeIcon,
} from '@rustrak/ui';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import {
  getProjectEnvironments,
  getProjectReleases,
} from '@/features/project/api/queries';
import {
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
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
    <div className="flex w-full divide-x divide-border-divider rounded-md border border-border bg-surface sm:inline-flex sm:w-auto">
      <Segment
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
      <Segment
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
      <Segment
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
    </div>
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

/** "All", then every value, or a line saying there are none yet. */
function scopeActions(
  options: string[],
  value: string | undefined,
  allLabel: string,
  emptyLabel: string,
  onSelect: (value: string | undefined) => void,
): MenuAction[] {
  return [
    {
      id: '*',
      label: allLabel,
      selected: value === undefined,
      onSelect: () => onSelect(undefined),
    },
    ...(options.length === 0
      ? [{ id: '-', label: emptyLabel, disabled: true, separated: true }]
      : options.map((option, index) => ({
          id: option,
          label: option,
          selected: option === value,
          separated: index === 0,
          onSelect: () => onSelect(option),
        }))),
  ];
}

/** One part of the bar: a menu, its icon and what it is set to. */
function Segment({
  icon: Icon,
  label,
  active,
  mono,
  actions,
}: {
  icon: IconComponent;
  label: ReactNode;
  /** A scope that is set; the window is always set, so it never is. */
  active?: boolean;
  mono?: boolean;
  actions: MenuAction[];
}) {
  // Its own box: an open menu puts focus guards beside its trigger, and as
  // siblings in the bar they took the divider and the last corner, shifting
  // the bar by a pixel and squaring the end the menu opened from.
  return (
    <div className="flex min-w-0 flex-1 first:rounded-l-md last:rounded-r-md sm:max-w-48 sm:flex-none">
      <Menu
        align="end"
        actions={actions}
        popupClassName="max-h-80 min-w-48 overflow-y-auto"
        trigger={
          <button
            type="button"
            className={cn(
              'flex h-control-md min-w-0 flex-1 items-center gap-1.5 px-2.5 text-control',
              // The corners are the box's, so the hover fill follows them.
              'rounded-[inherit]',
              'hover:bg-surface-hover hover:text-fg data-popup-open:bg-surface-hover',
              active ? 'font-medium text-fg' : 'text-fg-subtle',
              interactiveTransition,
              focusRing,
            )}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-pill bg-surface-brand"
              />
            ) : (
              <Icon size="sm" className="shrink-0" />
            )}
            <span className={cn('truncate', mono && 'font-mono')}>{label}</span>
            <ChevronDownIcon
              size="sm"
              className="ms-auto shrink-0 text-fg-ghost"
            />
          </button>
        }
      />
    </div>
  );
}
