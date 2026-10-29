import { Page, PageHeader, Text } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformIcon } from 'platformicons';
import { useFormatter, useTranslations } from 'use-intl';
import { getProject } from '@/features/project/api/queries';
import {
  DEFAULT_PERIOD,
  PERIOD_CHOICES,
} from '@/features/release/model/session-health';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf, searchString } from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { OverviewFilters } from './-components/overview-filters';
import {
  ErrorVolumePanel,
  IssuesPanel,
  KpiRow,
  LatencyPanel,
  SessionsPanel,
  useOverviewData,
} from './-components/overview-panels';

export const Route = createFileRoute('/_authenticated/projects/$id/')({
  validateSearch: (search: Record<string, unknown>) => ({
    // An unrecognized value is dropped rather than passed on: the API ignores
    // what it cannot parse and answers unfiltered, while no control reads as
    // selected. So the URL and the screen always agree.
    period: searchOneOf(search.period, PERIOD_CHOICES),
    environment: searchString(search.environment),
    release: searchString(search.release),
    compare: search.compare === true || search.compare === 'true' || undefined,
  }),
  loader: ({ params }) => getProject(Number.parseInt(params.id, 10)),
  head: ({ loaderData }) => {
    const t = translator('projectPages');

    if (!loaderData?.success) {
      return { meta: [{ title: t('projectNotFound') }] };
    }

    return {
      meta: [
        { title: t('projectTitle', { project: loaderData.data.name }) },
        {
          name: 'description',
          content: t('overview.meta.description', {
            project: loaderData.data.name,
          }),
        },
      ],
    };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const t = useTranslations('projectPages');
  const format = useFormatter();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectResult = Route.useLoaderData();
  const projectId = Number.parseInt(id, 10);

  const choice = search.period ?? DEFAULT_PERIOD;
  const period = choice === 'all' ? undefined : choice;
  // Nothing comes before all time, so there is nothing to compare it with.
  const compare = !!search.compare && period !== undefined;
  const filters = {
    projectId,
    period,
    environment: search.environment,
    release: search.release,
  };
  const data = useOverviewData(filters, compare);

  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title={t('loadProjectFailed')} />
    );
  }

  const project = projectResult.data;

  return (
    // On a phone the header scrolls away with the page: held in place, the
    // title and the filters would take a third of the screen.
    <div className="flex h-full flex-col max-lg:overflow-y-auto">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <PlatformIcon
              platform={project.platform ?? 'other'}
              size={26}
              format="lg"
              className="shrink-0 rounded-md"
            />
            <span className="truncate">{project.name}</span>
          </span>
        }
        summary={[
          <Text key="slug" variant="mono-sm" tone="meta">
            {project.slug}
          </Text>,
          t('overview.storedEvents', {
            count: format.number(project.stored_event_count, 'compact'),
          }),
        ]}
        actions={
          <OverviewFilters
            projectId={projectId}
            period={choice}
            environment={search.environment}
            release={search.release}
            onChange={(change) =>
              navigate({ search: (prev) => ({ ...prev, ...change }) })
            }
          />
        }
      />

      <Page className="max-lg:flex-none max-lg:overflow-visible">
        <KpiRow data={data} filters={filters} />

        {/* min-w-0 on every cell holding a chart: a grid item defaults to
            min-width:auto, so a chart's measured width can pin its column
            open and the page ends up scrolling sideways on a phone. */}
        <ErrorVolumePanel
          data={data}
          filters={filters}
          compare={compare}
          onCompareChange={(next) =>
            navigate({
              search: (prev) => ({ ...prev, compare: next || undefined }),
            })
          }
        />

        <div className="grid gap-4 xl:grid-cols-5">
          <div className="min-w-0 xl:col-span-3">
            <IssuesPanel filters={filters} />
          </div>
          <div className="min-w-0 xl:col-span-2">
            <SessionsPanel data={data} filters={filters} />
          </div>
        </div>

        <LatencyPanel projectId={projectId} />
      </Page>
    </div>
  );
}
