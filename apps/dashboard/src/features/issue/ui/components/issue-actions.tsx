import type {
  IssueResponse,
  Result,
  RustrakError,
  UpdateIssueState,
} from '@rustrak/client';
import {
  Button,
  CopyIcon,
  DeleteIcon,
  LinkIcon,
  Menu,
  type MenuAction,
  MoreIcon,
  MuteIcon,
  NotificationIcon,
  ResolveIcon,
  SplitButton,
  StarIcon,
  Tooltip,
  UnresolveIcon,
} from '@rustrak/ui';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import {
  deleteIssue,
  resolveIssueInNextRelease,
  setIssueBookmark,
  setIssueSubscription,
  updateIssueState,
} from '@/features/issue/api/mutations';
import { useRouter } from '@/shared/ui/hooks/use-router';
import { DeleteIssuesDialog } from './issues-table/delete-issues-dialog';

/**
 * One request against the issue, refreshed on success and spoken on failure.
 * Everything that changes the issue -- the header's buttons, the rail's
 * pickers, the keyboard -- goes through this, so they all fail and settle
 * the same way.
 */
export function useIssueChange(projectId: number, issue: IssueResponse) {
  const t = useTranslations('issues');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (
    request: () => Promise<Result<unknown, RustrakError>>,
    failed: string = t('toasts.updateFailed'),
  ) =>
    startTransition(async () => {
      const result = await request();
      if (!result.success) {
        toast.error(failed, { description: result.error.message });
        return;
      }
      router.refresh();
    });

  return {
    isPending,
    update: (body: UpdateIssueState, failed?: string) =>
      run(() => updateIssueState(projectId, issue.id, body), failed),
    run,
  };
}

/**
 * True while a key belongs to something else, when single-key shortcuts stand
 * down: a field being typed in, and a dialog or menu with focus -- an `r` in
 * the delete confirmation must not resolve the issue behind it, and a menu's
 * typeahead must not also run the page's action.
 */
function typing(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
    ),
  );
}

/**
 * Single-key shortcuts for the page, Linear-style: off while a field has
 * focus, and never with a modifier other than Shift, so the browser's own
 * shortcuts are untouched.
 */
export function useShortcuts(keys: Record<string, () => void>) {
  // The listener is added once and reads the latest keys through this ref,
  // written after each commit -- never during a render React may discard.
  const latest = useRef(keys);
  useLayoutEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event.target)) return;
      const action = latest.current[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

interface IssueActionBarProps {
  issue: IssueResponse;
  projectId: number;
  /** The reader, for "assign to me". */
  me: number;
  /** The GitHub control, when the project has a repository. */
  extra?: ReactNode;
}

/**
 * What can be done to the issue, ordered by how often it is done.
 *
 * The two verbs of triage -- resolve and archive -- are split buttons: the
 * common form one click away, its variants behind the chevron. Two toggles
 * that only change the reader's own relationship to the issue sit as icons.
 * Everything else goes in ⋯, which is where this bar grows: a new action is
 * a new row there, not a new button here. Every action has a key.
 */
export function IssueActionBar({
  issue,
  projectId,
  me,
  extra,
}: IssueActionBarProps) {
  const t = useTranslations('issues');
  const router = useRouter();
  const { isPending, update, run } = useIssueChange(projectId, issue);
  const [deleting, setDeleting] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const resolved = issue.status === 'resolved';
  const archived = issue.status === 'ignored';
  const feedback = issue.issue_category === 'feedback';

  const resolve = () =>
    update({ status: resolved ? 'unresolved' : 'resolved' });
  // Plain `ignored`: nothing on the server brings an archived issue back when
  // it escalates yet, so the page does not offer to wait for that.
  const archive = () =>
    update(archived ? { status: 'unresolved' } : { status: 'ignored' });
  const bookmark = () =>
    run(
      () => setIssueBookmark(projectId, issue.id, !issue.is_bookmarked),
      t('toasts.bookmarkFailed'),
    );
  const subscribe = () =>
    run(
      () => setIssueSubscription(projectId, issue.id, !issue.is_subscribed),
      t('toasts.subscriptionFailed'),
    );
  const copy = (text: string, done: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(done))
      .catch(() => {});
  };
  const copyLink = () => copy(window.location.href, t('detail.linkCopied'));

  // A key pressed again before the first request settles would act on the
  // state the page still shows -- bookmarking twice instead of toggling back
  // -- so a shortcut waits for the one before it.
  const once = (action: () => void) => () => {
    if (!isPending) action();
  };
  useShortcuts({
    r: once(resolve),
    e: once(archive),
    b: once(bookmark),
    i: once(() => update({ assigned_to: me })),
    C: copyLink,
  });

  const confirmDelete = () =>
    startDelete(async () => {
      const result = await deleteIssue(projectId, issue.id);
      if (!result.success) {
        toast.error(t('toasts.deleteOneFailed'), {
          description: result.error.message,
        });
        return;
      }
      setDeleting(false);
      router.push(`/projects/${projectId}/issues`);
    });

  const overflow: MenuAction[] = [
    {
      id: 'bookmark',
      label: issue.is_bookmarked
        ? t('actions.removeBookmark')
        : t('actions.bookmark'),
      icon: StarIcon,
      shortcut: 'B',
      // A toggle chosen again before the first settles would send the same
      // value twice instead of toggling back, as the shortcuts already avoid.
      disabled: isPending,
      onSelect: bookmark,
    },
    {
      id: 'subscribe',
      label: issue.is_subscribed
        ? t('actions.unsubscribe')
        : t('actions.subscribe'),
      icon: NotificationIcon,
      disabled: isPending,
      onSelect: subscribe,
    },
    {
      separated: true,
      id: 'link',
      label: t('detail.copyLink'),
      icon: LinkIcon,
      shortcut: '⇧C',
      onSelect: copyLink,
    },
    {
      id: 'id',
      label: t('table.copyId'),
      icon: CopyIcon,
      onSelect: () => copy(issue.short_id, t('table.copied')),
    },
    {
      id: 'assign-me',
      label: t('table.assignToMe'),
      shortcut: 'I',
      separated: true,
      disabled: isPending || issue.assigned_to === me,
      onSelect: () => update({ assigned_to: me }),
    },
    {
      id: 'delete',
      label: t('actions.deleteIssue'),
      icon: DeleteIcon,
      tone: 'danger',
      separated: true,
      onSelect: () => setDeleting(true),
    },
  ];

  return (
    // Full width when it has a row of its own, so the toggles and ⋯ sit at
    // the right edge; the two verbs never wrap apart.
    <div className="flex w-full items-center gap-2 @4xl:w-auto">
      {resolved ? (
        <Button
          variant="secondary"
          icon={UnresolveIcon}
          disabled={isPending}
          onClick={resolve}
          shortcut="R"
        >
          {t('actions.unresolve')}
        </Button>
      ) : (
        <SplitButton
          icon={ResolveIcon}
          onClick={resolve}
          disabled={isPending}
          menuLabel={t('moreResolveOptions')}
          actions={[
            {
              id: 'resolve',
              label: t('actions.resolve'),
              shortcut: 'R',
              onSelect: resolve,
            },
            {
              id: 'next-release',
              label: t('actions.resolveInNextRelease'),
              onSelect: () =>
                run(() => resolveIssueInNextRelease(projectId, issue.id)),
            },
          ]}
        >
          {t('actions.resolve')}
        </SplitButton>
      )}

      {/* One archive, with no "until escalating" beside it: that variant
          waits for the server to reopen issues that escalate. */}
      <Button
        variant="secondary"
        icon={MuteIcon}
        disabled={isPending}
        onClick={archive}
        shortcut="E"
      >
        {feedback
          ? archived
            ? t('actions.moveToInbox')
            : t('actions.markSpam')
          : archived
            ? t('actions.unarchive')
            : t('actions.archive')}
      </Button>

      <span
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-border-divider @4xl:block"
      />

      {/* The toggles are icons where there is room and rows of ⋯ where there
          is not: on a phone two more icons would push ⋯ off the row. */}
      <div className="ms-auto flex items-center gap-1 @4xl:ms-0">
        <Tooltip
          content={
            issue.is_bookmarked
              ? t('actions.removeBookmark')
              : t('actions.bookmark')
          }
        >
          <Button
            variant="ghost"
            icon={StarIcon}
            className="hidden @md:inline-flex"
            selected={issue.is_bookmarked ?? false}
            disabled={isPending}
            aria-label={t('actions.bookmark')}
            onClick={bookmark}
          />
        </Tooltip>
        <Tooltip
          content={
            issue.is_subscribed
              ? t('actions.unsubscribe')
              : t('actions.subscribe')
          }
        >
          <Button
            variant="ghost"
            icon={NotificationIcon}
            className="hidden @md:inline-flex"
            selected={issue.is_subscribed ?? false}
            disabled={isPending}
            aria-label={t('actions.subscribe')}
            onClick={subscribe}
          />
        </Tooltip>

        {extra}

        <Menu
          align="end"
          actions={overflow}
          trigger={
            <Button
              variant="ghost"
              icon={MoreIcon}
              aria-label={t('issueActionsLabel')}
            />
          }
        />
      </div>

      <DeleteIssuesDialog
        open={deleting}
        onOpenChange={setDeleting}
        count={1}
        isPending={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
