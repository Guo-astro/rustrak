import { Skeleton } from '@/shared/ui/components/shadcn/skeleton';

/** The overview's place while the figures load, inside its section. */
export function OverviewSkeleton() {
  return (
    <div className="space-y-3 px-5 py-4" aria-hidden="true">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="flex gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-28" />
        ))}
      </div>
    </div>
  );
}

/** The cleanup sentence's place while the figures load. */
export function LineSkeleton() {
  return (
    <div
      className="border-b border-border-divider px-5 py-4 last:border-b-0"
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

/** The age chart's place while the figures load. */
export function ChartSkeleton() {
  return <Skeleton className="h-48 w-full" aria-hidden="true" />;
}

/** The projects table's place while the figures load, inside its section. */
export function ProjectsSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-border-divider px-5 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
