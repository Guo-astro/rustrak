import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'use-intl';
import { issueQueries } from '@/features/issue/api/queries';
import { Button } from '@/shared/ui/components/shadcn/button';

/**
 * The feedback users sent about an error issue, newest first: the first page
 * from the route's loader, older pages on request.
 */
export function UserFeedback({
  projectId,
  issueId,
}: {
  projectId: number;
  issueId: string;
}) {
  const t = useTranslations('projectPages.event.feedback');
  const format = useFormatter();
  const {
    data: { pages },
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(issueQueries.userReports(projectId, issueId));
  const last = pages[pages.length - 1]!;
  // A report sent while paging shifts the offsets; keep each one once.
  const reports = [
    ...new Map(pages.flatMap((p) => p.items).map((r) => [r.id, r])).values(),
  ];

  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {reports.map((report) => (
          <li key={report.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-medium truncate">
                {report.name || t('anonymous')}
              </span>
              {report.email && (
                <a
                  href={`mailto:${report.email}`}
                  className="truncate text-muted-foreground hover:underline"
                >
                  {report.email}
                </a>
              )}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {format.relativeTime(new Date(report.created_at))}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {report.comments}
            </p>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {t('showOlder', {
            count: Math.max(last.total_count - reports.length, 0),
          })}
        </Button>
      )}
      {isFetchNextPageError && (
        <p className="text-xs text-destructive">{t('showOlderFailed')}</p>
      )}
    </div>
  );
}
