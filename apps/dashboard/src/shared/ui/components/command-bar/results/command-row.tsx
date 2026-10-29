import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  CommandItem,
  CommandShortcut,
} from '@/shared/ui/components/shadcn/command';

/**
 * Selection styling, spelled out rather than left to the generated component.
 *
 * cmdk writes `data-selected="false"` on every row, and Tailwind's bare
 * `data-selected:` variant matches the attribute's *presence*, so the kit's
 * own `data-selected:bg-muted` paints the whole list. Hence the explicit
 * `=true` test, with the same surface and ink a highlighted menu item gets.
 */
const SELECTED_ROW = cn(
  'data-[selected=false]:bg-transparent!',
  'data-[selected=true]:bg-surface-selected! data-[selected=true]:text-fg',
);

/** The icon's ink, raised with the row like a menu item's. */
export const ROW_ICON =
  'size-icon-lg text-fg-ghost group-data-[selected=true]/command-item:text-fg-subtle';

/**
 * One line per row, the anatomy of a menu item: icon, label, what it is, and
 * where it lives on the far edge.
 */
export function CommandRow({
  value,
  keywords,
  label,
  description,
  media,
  badge,
  onSelect,
  onHover,
  trailing,
}: {
  /** What the matcher scores against; the label alone is often too thin. */
  value: string;
  keywords?: string[];
  label: string;
  description: string;
  media: ReactNode;
  /** Where the row lives, when the list is mixing several places. */
  badge?: ReactNode;
  onSelect: () => void;
  onHover: () => void;
  trailing?: ReactNode;
}) {
  return (
    <CommandItem
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      // cmdk drives selection from the keyboard only. Without this the pointer
      // moves over a row and nothing happens, which reads as a dead list.
      onPointerMove={onHover}
      className={cn(
        'h-10 gap-3 rounded-lg! px-3 text-control text-fg-muted transition-none',
        SELECTED_ROW,
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {media}
      </span>
      {/* Takes the slack itself, so the trailing edge lines up on every row
          whatever the label's length. */}
      <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="shrink-0 truncate">{label}</span>
        <span className="min-w-0 truncate font-normal text-fg-meta text-hint">
          {description}
        </span>
      </span>
      {/* `CommandShortcut` is what makes the kit hide its own trailing
          CheckIcon, which would otherwise take the far edge. */}
      {badge || trailing ? (
        <CommandShortcut className="flex shrink-0 items-center gap-3 tracking-normal">
          {badge}
          {trailing}
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}
