import type {
  IssuePriority,
  IssueResponse,
  IssuesListResponse,
} from '@rustrak/client';
import {
  AssignIcon,
  Button,
  CopyIcon,
  DataTable,
  DataTableColumnsButton,
  type DataTableFeatures,
  type DataTableQuery,
  DeleteIcon,
  EnvironmentIcon,
  Menu,
  type MenuAction,
  MuteIcon,
  QueryBar,
  type QueryField,
  queryFieldsFromColumns,
  ReleaseIcon,
  ResolveIcon,
  UnresolveIcon,
  useDataTable,
} from '@rustrak/ui';
import type { Row } from '@tanstack/react-table';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'use-intl';
import {
  bulkDeleteIssues,
  bulkUpdateIssues,
  deleteIssue,
  updateIssueState,
} from '@/features/issue/api/mutations';
import type { IssueView } from '@/features/issue/model/issue-table';
import { useRouter } from '@/shared/ui/hooks/use-router';
import { DeleteIssuesDialog } from './delete-issues-dialog';
import { type Assignable, issueColumns } from './issue-columns';

const PRIORITIES: IssuePriority[] = ['high', 'medium', 'low'];

/** A change to some issues, as the list offers it. */
type Change =
  | { status: 'resolved' | 'unresolved' | 'ignored' }
  | { priority: IssuePriority }
  | { assigned_to: number | null };

/** Some issues, read when the menu item is chosen rather than when built. */
type Pick = () => IssueResponse[];

interface IssuesTableProps {
  projectId: number;
  page: IssuesListResponse;
  query: DataTableQuery;
  view: IssueView;
  onQueryChange: (
    updater: (previous: DataTableQuery) => DataTableQuery,
  ) => void;
  /** The next page is on its way: rows stay, dimmed. */
  loading: boolean;
  members: Assignable[];
  me: number;
  /** For the query bar's `environment:` and `release:` suggestions. */
  environments: string[];
  releases: string[];
}

/**
 * The issue list: a query bar over a table, both editing one query that lives
 * in the URL, with every change the triage needs one gesture away -- from
 * the row's own menu, or for a ticked batch from the header.
 */
export function IssuesTable({
  projectId,
  page,
  query,
  view,
  onQueryChange,
  loading,
  members,
  me,
  environments,
  releases,
}: IssuesTableProps) {
  const t = useTranslations('issues');
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<IssueResponse[] | null>(null);
  // The clock the relative times are read against, taken once per page.
  const [now] = useState(() => Date.now());

  const columns = useMemo(
    () => issueColumns({ projectId, t, format, members, me, now }),
    [projectId, t, format, members, me, now],
  );

  const fields = useMemo<QueryField[]>(
    () => [
      ...queryFieldsFromColumns(columns),
      {
        key: 'environment',
        label: t('table.environment'),
        icon: EnvironmentIcon,
        variant: 'options',
        multiple: false,
        options: environments.map((value) => ({ value, label: value })),
      },
      {
        key: 'release',
        label: t('table.release'),
        icon: ReleaseIcon,
        variant: 'options',
        multiple: false,
        options: releases.map((value) => ({ value, label: value })),
      },
    ],
    [columns, environments, releases, t],
  );

  const apply = (issues: IssueResponse[], change: Change) =>
    startTransition(async () => {
      const ids = issues.map((issue) => issue.id);
      // Status and priority go in one request; the API assigns one issue at
      // a time, so a batch assignment is one request per issue.
      const result =
        'assigned_to' in change
          ? (
              await Promise.all(
                ids.map((id) => updateIssueState(projectId, id, change)),
              )
            ).find((r) => !r.success)
          : await bulkUpdateIssues(projectId, { ids, ...change });

      if (result && !result.success) {
        toast.error(t('toasts.updateFailed'), {
          description: result.error.message,
        });
      } else {
        table.resetRowSelection();
      }
      // On a failure too: in a batch assignment the others went through, and
      // the rows have to show what the server now holds.
      router.refresh();
    });

  const confirmDelete = () =>
    startTransition(async () => {
      if (!deleting) return;
      const [single] = deleting;
      const result =
        deleting.length === 1 && single
          ? await deleteIssue(projectId, single.id)
          : await bulkDeleteIssues(projectId, {
              ids: deleting.map((issue) => issue.id),
            });
      if (!result.success) {
        toast.error(
          deleting.length === 1
            ? t('toasts.deleteOneFailed')
            : t('toasts.deleteManyFailed'),
          { description: result.error.message },
        );
        return;
      }
      table.resetRowSelection();
      setDeleting(null);
      router.refresh();
    });

  const { priorityItems, assignItems, rowMenu } = useIssueMenus({
    members,
    me,
    apply,
    setDeleting,
  });

  const table = useDataTable({
    data: page.items,
    columns,
    rowCount: page.total_count,
    query,
    onQueryChange,
    getRowId: (issue) => issue.id,
    enableSelection: true,
    rowMenu,
    storageKey: 'issues',
    initialVisibility: { level: false },
  });

  const selected = () =>
    table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <QueryBar
          className="min-w-0 flex-1"
          fields={fields}
          filters={query.filters}
          search={query.search}
          onChange={(next) =>
            onQueryChange((previous) => ({
              ...previous,
              filters: next.filters,
              search: next.search,
              pagination: { ...previous.pagination, pageIndex: 0 },
            }))
          }
        />
        <DataTableColumnsButton table={table} />
      </div>

      <DataTable
        table={table}
        loading={loading || isPending}
        className="min-h-0 flex-1"
        onRowClick={(row) =>
          router.push(`/projects/${projectId}/issues/${row.original.id}`)
        }
        empty={{
          title: t('empty.title'),
          // True only of an empty Open view with nothing narrowing it: an
          // empty Resolved view says nothing about what is still open.
          description:
            view === 'open' && !query.filters.length && !query.search
              ? t('empty.allResolved')
              : undefined,
        }}
        bulkActions={
          <BulkActions
            selected={selected}
            disabled={isPending}
            apply={apply}
            onDelete={setDeleting}
            priorityItems={priorityItems}
            assignItems={assignItems}
          />
        }
      />

      <DeleteIssuesDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        count={deleting?.length ?? 0}
        isPending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/**
 * The menus a row and a ticked batch share: priority, assignee, and the row's
 * own list of actions.
 *
 * They are built once per column set rather than once per render, so they
 * reach the latest handlers through a ref whose identity never changes. It is
 * written after each render, never during one.
 */
function useIssueMenus({
  members,
  me,
  apply,
  setDeleting,
}: {
  members: Assignable[];
  me: number;
  apply: (issues: IssueResponse[], change: Change) => void;
  setDeleting: (issues: IssueResponse[]) => void;
}) {
  const t = useTranslations('issues');
  const handlers = useRef({ apply, setDeleting });
  useLayoutEffect(() => {
    handlers.current = { apply, setDeleting };
  });

  const priorityItems = useCallback(
    (issues: Pick, current?: string | null): MenuAction[] =>
      PRIORITIES.map((priority) => ({
        id: priority,
        label: t(`issueStatus.${priority}`),
        selected: priority === current,
        onSelect: () => handlers.current.apply(issues(), { priority }),
      })),
    [t],
  );

  const assignItems = useCallback(
    (issues: Pick, current?: number | null): MenuAction[] => [
      {
        id: 'me',
        label: t('table.assignToMe'),
        selected: current === me,
        onSelect: () => handlers.current.apply(issues(), { assigned_to: me }),
      },
      {
        id: 'none',
        label: t('table.unassign'),
        disabled: current === null,
        onSelect: () => handlers.current.apply(issues(), { assigned_to: null }),
      },
      ...members
        .filter((member) => member.id !== me)
        .map((member, index) => ({
          id: String(member.id),
          label: member.email,
          selected: current === member.id,
          separated: index === 0,
          onSelect: () =>
            handlers.current.apply(issues(), { assigned_to: member.id }),
        })),
    ],
    [members, me, t],
  );

  const rowMenu = useCallback(
    (row: Row<DataTableFeatures, IssueResponse>): MenuAction[] => {
      const issue = row.original;
      const one = () => [issue];
      const resolved = issue.status === 'resolved';
      const muted = issue.status === 'ignored';
      return [
        {
          id: 'resolve',
          label: resolved ? t('actions.unresolve') : t('actions.resolve'),
          icon: resolved ? UnresolveIcon : ResolveIcon,
          onSelect: () =>
            handlers.current.apply(one(), {
              status: resolved ? 'unresolved' : 'resolved',
            }),
        },
        {
          id: 'mute',
          label: muted ? t('actions.unmute') : t('actions.mute'),
          icon: MuteIcon,
          onSelect: () =>
            handlers.current.apply(one(), {
              status: muted ? 'unresolved' : 'ignored',
            }),
        },
        {
          id: 'priority',
          label: t('priority'),
          separated: true,
          items: priorityItems(one, issue.priority),
        },
        {
          id: 'assign',
          label: t('table.assign'),
          icon: AssignIcon,
          items: assignItems(one, issue.assigned_to),
        },
        {
          id: 'copy',
          label: t('table.copyId'),
          icon: CopyIcon,
          separated: true,
          onSelect: () => {
            navigator.clipboard
              ?.writeText(issue.short_id)
              .then(() => toast.success(t('table.copied')))
              .catch(() => {});
          },
        },
        {
          id: 'delete',
          label: t('actions.delete'),
          icon: DeleteIcon,
          tone: 'danger',
          onSelect: () => handlers.current.setDeleting(one()),
        },
      ];
    },
    [t, priorityItems, assignItems],
  );

  return { priorityItems, assignItems, rowMenu };
}

/** What a ticked batch can have done to it, in the table's header. */
function BulkActions({
  selected,
  disabled,
  apply,
  onDelete,
  priorityItems,
  assignItems,
}: {
  selected: Pick;
  disabled: boolean;
  apply: (issues: IssueResponse[], change: Change) => void;
  onDelete: (issues: IssueResponse[]) => void;
  priorityItems: (issues: Pick) => MenuAction[];
  assignItems: (issues: Pick) => MenuAction[];
}) {
  const t = useTranslations('issues');
  return (
    <>
      <Button
        size="xs"
        variant="primary"
        icon={ResolveIcon}
        disabled={disabled}
        onClick={() => apply(selected(), { status: 'resolved' })}
      >
        {t('actions.resolve')}
      </Button>
      <Button
        size="xs"
        variant="secondary"
        icon={MuteIcon}
        disabled={disabled}
        onClick={() => apply(selected(), { status: 'ignored' })}
      >
        {t('actions.mute')}
      </Button>
      <Menu
        actions={priorityItems(selected)}
        trigger={
          <Button size="xs" variant="secondary" menu disabled={disabled}>
            {t('priority')}
          </Button>
        }
      />
      <Menu
        actions={assignItems(selected)}
        trigger={
          <Button
            size="xs"
            variant="secondary"
            icon={AssignIcon}
            menu
            disabled={disabled}
          >
            {t('table.assign')}
          </Button>
        }
      />
      <Button
        size="xs"
        variant="danger"
        icon={DeleteIcon}
        disabled={disabled}
        onClick={() => onDelete(selected())}
      >
        {t('actions.delete')}
      </Button>
    </>
  );
}
