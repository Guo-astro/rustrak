import type { MenuAction } from '@rustrak/ui';

/** "All", then every value, or a line saying there are none yet. */
export function scopeActions(
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
