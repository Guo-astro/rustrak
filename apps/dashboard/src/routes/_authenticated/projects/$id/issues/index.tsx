import {
  type DataTableQuery,
  Page,
  PageHeader,
  parseTableQuery,
  serializeTableQuery,
  Tab,
  TabList,
  Tabs,
} from '@rustrak/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { useFormatter, useTranslations } from 'use-intl';
import { issueQueries } from '@/features/issue/api/queries';
import { assignable } from '@/features/issue/model/assignable';
import {
  ISSUE_FILTER_VARIANTS,
  ISSUE_VIEWS,
  type IssueView,
  issueListParams,
  withServerQuery,
} from '@/features/issue/model/issue-table';
import { IssuesTable } from '@/features/issue/ui/components/issues-table/issues-table';
import { projectQueries } from '@/features/project/api/queries';
import { userQueries } from '@/features/user/api/queries';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';

const PAGE_SIZE = 50;

/**
 * The search, exactly as the table's codecs write it: `q` holds the filters
 * and the free text in the query bar's own syntax, so the address is the bar.
 */
interface IssuesSearch {
  view?: IssueView;
  q?: string;
  sort?: string;
  page?: string;
  per?: string;
}

function tableQuery(search: IssuesSearch): DataTableQuery {
  const params = new URLSearchParams();
  for (const key of ['q', 'sort', 'page', 'per'] as const) {
    const value = search[key];
    if (value) params.set(key, value);
  }
  return parseTableQuery(params, ISSUE_FILTER_VARIANTS, PAGE_SIZE);
}

/** The page of issues a URL shows, for the loader and the component alike. */
function issuesList(projectId: number, search: IssuesSearch) {
  return issueQueries.list(
    projectId,
    issueListParams(tableQuery(search), search.view ?? 'open'),
  );
}

/** A query and a view, written the way the address holds them. */
function toSearch(query: DataTableQuery, view: IssueView): IssuesSearch {
  const params = serializeTableQuery(query, ISSUE_FILTER_VARIANTS, PAGE_SIZE);
  return {
    view: view === 'open' ? undefined : view,
    q: params.get('q') ?? undefined,
    sort: params.get('sort') ?? undefined,
    page: params.get('page') ?? undefined,
    per: params.get('per') ?? undefined,
  };
}

export const Route = createFileRoute('/_authenticated/projects/$id/issues/')({
  // Read and written back, so the address keeps only what the table reads:
  // an unknown sort, or a page that is not a number, is dropped rather than
  // left in a URL that no control shows.
  validateSearch: (search: Record<string, unknown>): IssuesSearch => {
    const view =
      searchOneOf(search.view, ISSUE_VIEWS) ??
      // What the list's address called it before the redesign: links saved
      // then still open the view they name.
      searchOneOf(search.filter, ISSUE_VIEWS) ??
      'open';
    const raw = (value: unknown) =>
      searchString(value == null ? undefined : String(value));
    const query = tableQuery({
      q: raw(search.q),
      sort: raw(search.sort),
      page: raw(search.page),
      per: raw(search.per),
    });
    return toSearch(withServerQuery(query, PAGE_SIZE), view);
  },
  loaderDeps: ({ search }) => search,
  // Who can be assigned, and what the bar can suggest, are only started:
  // none of it is the list itself, so the list does not wait for it.
  loader: async ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    void queryClient.prefetchQuery(userQueries.members(projectId));
    void queryClient.prefetchQuery(projectQueries.environments(projectId));
    void queryClient.prefetchQuery(projectQueries.releaseVersions(projectId));
    const [project] = await Promise.all([
      queryClient.query({
        ...projectQueries.detail(projectId),
        staleTime: 'static',
      }),
      queryClient.query({
        ...issuesList(projectId, deps),
        staleTime: 'static',
      }),
    ]);
    return { project };
  },
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData) {
      return { meta: [{ title: t('projectNotFound') }] };
    }

    const { project } = loaderData;
    return {
      meta: [
        { title: t('projectTitle', { project: project.name }) },
        {
          name: 'description',
          content: t('issues.meta.description', { project: project.name }),
        },
      ],
    };
  },
  component: IssuesPage,
});

function IssuesPage() {
  const t = useTranslations('projectPages');
  const tIssues = useTranslations('issues');
  const format = useFormatter();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const context = Route.useRouteContext();
  const loading = useRouterState({ select: (state) => state.isLoading });
  const projectId = Number.parseInt(id, 10);
  const me = context.state === 'authenticated' ? context.user.id : 0;
  const view = search.view ?? 'open';
  const query = tableQuery(search);
  const { data: project } = useSuspenseQuery(projectQueries.detail(projectId));
  const { data: page } = useSuspenseQuery(issuesList(projectId, search));
  // Suggestions only: without them the list still works.
  const members = useQuery(userQueries.members(projectId)).data ?? [];
  const environments =
    useQuery(projectQueries.environments(projectId)).data ?? [];
  const releases =
    useQuery(projectQueries.releaseVersions(projectId)).data ?? [];

  // Each change applies to the address as it is when it lands, not as it was
  // when this render read it: two changes in one gesture (clearing the
  // filters and then the search) must not have the second undo the first.
  const setQuery = (
    update: (previous: DataTableQuery) => DataTableQuery,
    nextView?: IssueView,
  ) =>
    navigate({
      search: (previous) =>
        toSearch(
          update(tableQuery(previous)),
          nextView ?? previous.view ?? 'open',
        ),
    });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('issues.title')}
        // What the page is, then how much of it there is.
        summary={[
          t('issues.subtitle', { project: project.name }),
          tIssues('table.count', {
            count: page.total_count,
            display: format.number(page.total_count),
          }),
        ]}
        tabs={
          <Tabs
            value={view}
            onValueChange={(next) =>
              setQuery(
                (previous) => ({
                  ...previous,
                  pagination: { ...previous.pagination, pageIndex: 0 },
                }),
                next as IssueView,
              )
            }
          >
            <TabList>
              {ISSUE_VIEWS.map((value) => (
                <Tab key={value} value={value}>
                  {tIssues(`table.views.${value}`)}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        }
      />

      <Page scroll={false}>
        <IssuesTable
          projectId={projectId}
          page={page}
          query={query}
          view={view}
          onQueryChange={setQuery}
          loading={loading}
          me={me}
          members={assignable(
            members,
            context.state === 'authenticated' ? context.user : null,
          )}
          environments={environments}
          releases={releases}
        />
      </Page>
    </div>
  );
}
