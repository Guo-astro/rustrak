import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { CommandGroup } from '@/shared/ui/components/shadcn/command';

/**
 * Group headings, restyled from outside the generated component to read like
 * a menu's group label: mono, uppercase, the column face. `**:` reaches the
 * `[cmdk-group-heading]` element cmdk renders for us, which is the only
 * handle we get on it.
 */
const GROUP_HEADING = cn(
  '**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3',
  '**:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:font-mono',
  '**:[[cmdk-group-heading]]:text-column **:[[cmdk-group-heading]]:uppercase',
  '**:[[cmdk-group-heading]]:text-fg-meta',
);

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <CommandGroup heading={heading} className={cn('p-0', GROUP_HEADING)}>
      {children}
    </CommandGroup>
  );
}
