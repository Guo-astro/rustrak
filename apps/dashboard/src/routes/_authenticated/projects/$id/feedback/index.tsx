import type { UpdateIssueState } from '@rustrak/client';
import {
  cn,
  EmptyIcon,
  Page,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  Text,
} from '@rustrak/ui';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { updateIssueState } from '@/features/issue/api/mutations';
import { listFeedback } from '@/features/issue/api/queries';
import {
  MAILBOX_FILTER,
  MAILBOXES,
  nextAfter,
} from '@/features/issue/model/feedback-mailbox';
import { FeedbackDetail } from '@/features/issue/ui/components/feedback-detail';
import { FeedbackList } from '@/features/issue/ui/components/feedback-list';
import { useShortcuts } from '@/features/issue/ui/components/issue-actions';
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import {
  searchOneOf,
  searchPage,
  searchString,
} from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { useRouter } from '@/shared/ui/hooks/use-router';

/**
 * User feedback: Sentry's feedback inbox. Every feedback is its own issue of
 * category `feedback`, kept out of the issue list and listed here instead.
 *
 * A mail client's layout: the list on the left, the open one on the right,
 * and triage on the keyboard -- j and k to move, r to resolve, e for spam.
 * A feedback that leaves the mailbox hands the pane to the next one, so a
 * backlog is read top to bottom without reaching for the mouse.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/feedback/')({
  validateSearch: (search: Record<string, unknown>) => ({
    mailbox: searchOneOf(search.mailbox, MAILBOXES),
    page: searchPage(search.page),
    selected: searchString(search.selected),
  }),
  loaderDeps: ({ search }) => ({
    mailbox: search.mailbox ?? 'inbox',
    page: search.page ?? 1,
  }),
  loader: ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    return loadAll([
      getProject(projectId),
      listFeedback(projectId, {
        filter: MAILBOX_FILTER[deps.mailbox],
        page: deps.page,
        per_page: 25,
      }),
    ]);
  },
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData?.success) {
      return { meta: [{ title: t('projectNotFound') }] };
    }

    const [project] = loaderData.data;
    return {
      meta: [
        { title: t('projectTitle', { project: project.name }) },
        {
          name: 'description',
          content: t('feedback.meta.description', { project: project.name }),
        },
      ],
    };
  },
  component: FeedbackPage,
});

function FeedbackPage() {
  const t = useTranslations('projectPages');
  const tIssues = useTranslations('issues');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const mailbox = search.mailbox ?? 'inbox';
  const page = search.page ?? 1;
  const navigate = Route.useNavigate();
  const router = useRouter();
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' });
  const [isUpdating, startUpdate] = useTransition();
  const loaded = Route.useLoaderData();
  const projectId = Number.parseInt(id, 10);

  const items = loaded.success ? loaded.data[1].items : [];
  const ids = items.map((item) => item.id);
  // One is always open: the one the URL names, else the newest.
  const current = items.find((item) => item.id === search.selected) ?? items[0];
  const isPending = isLoading || isUpdating;

  const select = (selected: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, selected }), replace: true });

  const step = (by: number) => {
    const next = current && ids[ids.indexOf(current.id) + by];
    if (next) select(next);
  };

  // Either verb moves the feedback to another mailbox, so the pane moves on.
  const change = (body: UpdateIssueState) => {
    if (!current || isPending) return;
    startUpdate(async () => {
      const result = await updateIssueState(projectId, current.id, body);
      if (!result.success) {
        toast.error(tIssues('toasts.updateFailed'), {
          description: result.error.message,
        });
        return;
      }
      await select(nextAfter(ids, current.id));
      router.refresh();
    });
  };
  const resolve = () =>
    change({
      status: current?.status === 'resolved' ? 'unresolved' : 'resolved',
    });
  const spam = () =>
    change(
      current?.status === 'ignored'
        ? { status: 'unresolved' }
        : { status: 'ignored', substatus: 'archived_until_escalating' },
    );

  useShortcuts({ j: () => step(1), k: () => step(-1), r: resolve, e: spam });

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={t('feedback.loadFailed')} />
    );
  }

  const [project, feedback] = loaded.data;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('feedback.title')}
        summary={[
          t('feedback.subtitle', { project: project.name }),
          t('feedback.count', { count: feedback.total_count }),
        ]}
        tabs={
          <Tabs
            value={mailbox}
            onValueChange={(next) =>
              navigate({
                search: {
                  mailbox:
                    next === 'inbox' ? undefined : (next as typeof mailbox),
                  page: undefined,
                  selected: undefined,
                },
              })
            }
          >
            <TabList>
              {MAILBOXES.map((box) => (
                <Tab key={box} value={box}>
                  {t(`feedback.mailbox.${box}`)}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        }
      />

      {current ? (
        <Page scroll={false} className="lg:flex-row">
          {/* Narrow, the pane replaces the list once the reader picks one. */}
          <div
            className={cn(
              'min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-panel lg:flex lg:w-96 lg:flex-none xl:w-[28rem]',
              search.selected ? 'hidden' : 'flex',
            )}
          >
            <FeedbackList
              feedback={feedback}
              selectedId={current.id}
              page={page}
              isPending={isPending}
              onSelect={select}
              onPageChange={(next) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: next === 1 ? undefined : next,
                    selected: undefined,
                  }),
                })
              }
            />
          </div>
          <div
            className={cn(
              // A card beside the list; on its own on a phone, the page is the card.
              'min-h-0 flex-1 flex-col overflow-hidden lg:flex lg:rounded-lg lg:border lg:border-border lg:bg-panel',
              search.selected ? 'flex' : 'hidden',
            )}
          >
            <FeedbackDetail
              key={current.id}
              projectId={projectId}
              feedback={current}
              isPending={isPending}
              onResolve={resolve}
              onSpam={spam}
              onBack={() => select(undefined)}
            />
          </div>
        </Page>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-page-gutter py-16 text-center">
          <EmptyIcon size="xl" className="mb-2 text-fg-ghost" />
          <Text variant="body">{t('feedback.empty.title')}</Text>
          <Text variant="meta" tone="subtle" className="max-w-sm">
            {t('feedback.empty.description')}
          </Text>
        </div>
      )}
    </div>
  );
}
