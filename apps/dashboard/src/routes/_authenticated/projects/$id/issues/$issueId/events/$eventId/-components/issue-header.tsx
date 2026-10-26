import type { IssueResponse } from '@rustrak/client';
import { CopyIcon, cn, Tag, type TagTone, Text } from '@rustrak/ui';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'use-intl';
import { statusDisplay } from '@/features/issue/model/status';
import { IssueActionBar } from '@/features/issue/ui/components/issue-actions';

const LEVEL_STRIPE: Record<string, string> = {
  fatal: 'bg-sev-error',
  error: 'bg-sev-error',
  warning: 'bg-sev-warning',
};

const STATUS_TONE: Record<string, TagTone> = {
  resolved: 'neutral',
  ignored: 'neutral',
  unresolved: 'warning',
};

/**
 * The issue's identity and what can be done to it.
 *
 * Left, what broke, read top to bottom from the most specific: the short id
 * and status, the error type, its message, then where and when. Right, the
 * action bar. The two never mix -- facts on one side, verbs on the other --
 * which is what lets the bar grow without crowding what the issue is.
 */
export function IssueHeader({
  issue,
  projectId,
  me,
  titleType,
  message,
  github,
}: {
  issue: IssueResponse;
  projectId: number;
  me: number;
  titleType: string;
  message: string;
  github?: ReactNode;
}) {
  const t = useTranslations('issues');
  const format = useFormatter();
  const status = statusDisplay(issue);

  const copyId = () => {
    navigator.clipboard
      ?.writeText(issue.short_id)
      .then(() => toast.success(t('table.copied')))
      .catch(() => {});
  };

  return (
    // Laid out by its own width, not the window's: beside the app sidebar a
    // wide window can still leave a narrow header. Narrow, the actions take
    // their own full-width row under the identity; wide, they sit beside it.
    <header className="@container shrink-0 border-border-divider border-b px-page-gutter pt-6 pb-5">
      <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between @4xl:gap-8">
        <div className="flex min-w-0 flex-1 gap-4">
          <span
            aria-hidden="true"
            className={cn(
              'w-1 shrink-0 self-stretch rounded-pill',
              LEVEL_STRIPE[issue.level ?? ''] ?? 'bg-sev-info',
            )}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyId}
                title={t('table.copyId')}
                className="group/id inline-flex items-center gap-1.5 rounded-sm font-mono text-mono-sm text-fg-meta hover:text-fg"
              >
                {issue.short_id}
                <CopyIcon
                  size="sm"
                  aria-hidden="true"
                  className="opacity-0 group-hover/id:opacity-100"
                />
              </button>
              <Tag variant="soft" tone={STATUS_TONE[issue.status] ?? 'neutral'}>
                {t(status.labelKey)}
              </Tag>
              {issue.level ? (
                <Text variant="meta" tone="subtle">
                  {issue.level}
                </Text>
              ) : null}
            </div>

            <h1 className="truncate text-page-title text-fg">{titleType}</h1>
            {message ? (
              <p className="truncate font-mono text-mono text-fg-secondary">
                {message}
              </p>
            ) : null}

            {/* No separators between the facts: a line that wraps would leave
                one hanging at its end. The gap is the separator. */}
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5 text-meta text-fg-subtle">
              {issue.culprit ? (
                <span className="max-w-full truncate font-mono">
                  {issue.culprit}
                </span>
              ) : null}
              <span
                title={format.dateTime(new Date(issue.first_seen), 'dateTime')}
              >
                {t('detail.firstSeen', {
                  when: format.relativeTime(new Date(issue.first_seen)),
                })}
              </span>
              <span
                title={format.dateTime(new Date(issue.last_seen), 'dateTime')}
              >
                {t('detail.lastSeen', {
                  when: format.relativeTime(new Date(issue.last_seen)),
                })}
              </span>
            </p>
          </div>
        </div>

        <IssueActionBar
          issue={issue}
          projectId={projectId}
          me={me}
          extra={github}
        />
      </div>
    </header>
  );
}
