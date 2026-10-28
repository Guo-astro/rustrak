import {
  type DataTableQuery,
  EmptyIcon,
  type FilterVariants,
  Page,
  PageHeader,
  parseTableQuery,
  serializeTableQuery,
  Text,
} from '@rustrak/ui';
import {
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import {
  getProject,
  getProjectEnvironments,
} from '@/features/project/api/queries';
import { listReleases } from '@/features/release/api/queries';
import {
  DEFAULT_PERIOD,
  PERIOD_CHOICES,
  type PeriodChoice,
} from '@/features/release/model/session-health';
import { ReleasesTable } from '@/features/release/ui/components/releases-table';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { useAsync } from '@/shared/ui/hooks/use-async';
import { PeriodFilter } from './-components/release-filters';

const PAGE_SIZE = 25;
/** `list_releases`'s own cap on `per_page`. */
const MAX_PAGE_SIZE = 100;

/** `environment:` is the one key the bar takes; the rest is the version. */
const VARIANTS: FilterVariants = { environment: 'options' };

/** The search as the table's codecs write it: `q` is the query bar. */
interface ReleasesSearch {
  q?: string;
  period?: PeriodChoice;
  page?: string;
  per?: string;
}

function tableQuery(search: ReleasesSearch): DataTableQuery {
  const params = new URLSearchParams();
  for (const key of ['q', 'page', 'per'] as const) {
    const value = search[key];
    if (value) params.set(key, value);
  }
  const query = parseTableQuery(params, VARIANTS, PAGE_SIZE);
  // The API pages at most 100 releases; a larger `?per=` would have the
  // table expect rows it never receives, and no next page to reach them.
  query.pagination.pageSize = Math.min(
    query.pagination.pageSize,
    MAX_PAGE_SIZE,
  );
  return query;
}

/** The environment the bar picked, if any. */
function environmentOf(query: DataTableQuery): string | undefined {
  const value = query.filters.find((f) => f.id === 'environment')?.value;
  return Array.isArray(value) ? value[0] : undefined;
}

export const Route = createFileRoute('/_authenticated/projects/$id/releases/')({
  validateSearch: (search: Record<string, unknown>): ReleasesSearch => ({
    q: searchString(search.q),
    period: searchOneOf(search.period, PERIOD_CHOICES),
    page: searchString(String(search.page ?? '')) || undefined,
    per: searchString(String(search.per ?? '')) || undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const query = tableQuery(deps);
    const period = deps.period ?? DEFAULT_PERIOD;
    const loaded = await loadAll([
      getProject(projectId),
      listReleases(projectId, {
        environment: environmentOf(query),
        query: query.search || undefined,
        period: period === 'all' ? undefined : period,
        page: query.pagination.pageIndex + 1,
        per_page: query.pagination.pageSize,
      }),
    ]);

    // A stale or shared `?page=` past the end lands on the last page, not on
    // an empty table under a positive count.
    if (loaded.success) {
      const { total_pages } = loaded.data[1];
      if (query.pagination.pageIndex + 1 > Math.max(total_pages, 1)) {
        throw redirect({
          to: '/projects/$id/releases',
          params: { id: params.id },
          search: {
            ...deps,
            page: total_pages > 1 ? String(total_pages) : undefined,
          },
        });
      }
    }
    return loaded;
  },
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData?.success) {
      return { meta: [{ title: t('projectNotFound') }] };
    }

    const [project] = loaderData.data;
    return {
      meta: [
        { title: t('releases.meta.title', { project: project.name }) },
        {
          name: 'description',
          content: t('releases.meta.description', { project: project.name }),
        },
      ],
    };
  },
  component: ReleasesPage,
});

function ReleasesPage() {
  const t = useTranslations('projectPages');
  const tReleases = useTranslations('releases');
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const loading = useRouterState({ select: (state) => state.isLoading });
  const projectId = Number.parseInt(id, 10);
  const query = tableQuery(search);
  const period = search.period ?? DEFAULT_PERIOD;

  // What the bar can suggest; not the list, so the list does not wait for it.
  const environments = useAsync(
    () => getProjectEnvironments(projectId),
    [projectId],
  );

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={tReleases('loadFailed')} />;
  }

  const [project, page] = loaded.data;
  const filtered = query.search !== '' || query.filters.length > 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('releases.title')}
        summary={[
          project.name,
          tReleases('count', { count: page.total_count }),
        ]}
      />

      {page.total_count === 0 && !filtered ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-page-gutter py-16 text-center">
          <EmptyIcon size="xl" className="mb-2 text-fg-ghost" />
          <Text variant="body">{tReleases('empty.title')}</Text>
          <Text variant="meta" tone="subtle" className="max-w-md">
            {tReleases.rich('empty.description', {
              code: (chunks) => <code className="font-mono">{chunks}</code>,
            })}
          </Text>
        </div>
      ) : (
        <Page scroll={false}>
          <ReleasesTable
            projectId={projectId}
            page={page}
            query={query}
            loading={loading}
            environments={
              environments.state === 'ready' && environments.data.success
                ? environments.data.data
                : []
            }
            onQueryChange={(updater) => {
              const params = serializeTableQuery(
                updater(query),
                VARIANTS,
                PAGE_SIZE,
              );
              navigate({
                search: (prev) => ({
                  ...prev,
                  q: params.get('q') ?? undefined,
                  page: params.get('page') ?? undefined,
                  per: params.get('per') ?? undefined,
                }),
              });
            }}
            scope={{ environment: environmentOf(query), period: search.period }}
            period={
              <PeriodFilter
                period={period}
                onChange={(next) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      period: next === DEFAULT_PERIOD ? undefined : next,
                      page: undefined,
                    }),
                  })
                }
              />
            }
          />
        </Page>
      )}
    </div>
  );
}
