import type { AlertRuleResponse } from '@rustrak/client';
import {
  Button,
  IntegrationsIcon,
  NewIcon,
  Page,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  Text,
} from '@rustrak/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { alertMutations } from '@/features/alert/api/mutations';
import { alertQueries } from '@/features/alert/api/queries';
import { alertHref, newAlertHref } from '@/features/alert/model/rule-summary';
import { HistoryTable } from '@/features/alert/ui/components/alert-history';
import {
  AlertStarters,
  RulesTable,
} from '@/features/alert/ui/components/rule-list';
import { projectQueries } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { searchOneOf } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';
import { QueryState } from '@/shared/ui/components/query-state';

const VIEWS = ['rules', 'deliveries'] as const;
const HISTORY = { limit: 100 };

/**
 * Alerts: every rule of the project as a table, and every delivery they
 * made as another, one tab each. Rules are independent: new issues can go by
 * email with one set of filters and to Slack with another.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/alerts/')({
  validateSearch: (search: Record<string, unknown>) => ({
    view: searchOneOf(search.view, VIEWS),
  }),
  head: () => ({
    meta: [{ title: translator('alerts')('overview.metaTitle') }],
  }),
  loaderDeps: ({ search }) => ({ view: search.view }),
  // The lists used to fall back to `[]`, which drew "no alert rules yet" over
  // an outage and invited the admin to recreate rules that already exist, so
  // they are awaited. The deliveries are awaited on their own tab; on the
  // rules tab they only count the failures in the header, which can wait.
  loader: async ({ context: { queryClient }, params, deps }) => {
    const projectId = Number.parseInt(params.id, 10);
    const history = alertQueries.history(projectId, HISTORY);
    if (deps.view !== 'deliveries') void queryClient.prefetchQuery(history);
    await Promise.all([
      queryClient.query({
        ...alertQueries.ruleList(projectId),
        staleTime: 'static',
      }),
      queryClient.query({
        ...alertQueries.integrations(),
        staleTime: 'static',
      }),
      deps.view === 'deliveries' &&
        queryClient.query({ ...history, staleTime: 'static' }),
    ]);
  },
  component: AlertsPage,
});

function AlertsPage() {
  const t = useTranslations('alerts');
  const { id } = Route.useParams();
  const { view = 'rules' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectId = Number.parseInt(id, 10);
  const { data: project } = useSuspenseQuery(projectQueries.detail(projectId));
  const { data: rules } = useSuspenseQuery(alertQueries.ruleList(projectId));
  const { data: integrations } = useSuspenseQuery(alertQueries.integrations());
  const history = useQuery(alertQueries.history(projectId, HISTORY));
  const update = useMutation(alertMutations.updateRule(projectId));

  const active = rules.filter((r) => r.is_enabled).length;
  const failed = (history.data ?? []).filter(
    (h) => h.status === 'failed',
  ).length;
  const channelsHref = `/settings/integrations?projectId=${projectId}`;

  const toggle = (rule: AlertRuleResponse, enabled: boolean) =>
    update.mutate(
      { ruleId: rule.id, body: { is_enabled: enabled } },
      {
        onError: (error) =>
          toast.error(t('ruleDialog.saveFailed'), {
            description: error.error.message,
          }),
        onSuccess: () =>
          toast.success(t(enabled ? 'list.resumed' : 'list.pausedToast')),
      },
    );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('overview.title')}
        summary={[
          project.name,
          t('overview.activeCount', { count: active }),
          failed > 0 ? (
            <span className="text-sev-error-fg">
              {t('overview.failedCount', { count: failed })}
            </span>
          ) : null,
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={IntegrationsIcon}
              render={<Link href={channelsHref} />}
            >
              {t('overview.channels', { count: integrations.length })}
            </Button>
            <Button
              variant="primary"
              icon={NewIcon}
              render={<Link href={newAlertHref(projectId)} />}
            >
              {t('overview.new')}
            </Button>
          </div>
        }
        tabs={
          <Tabs
            value={view}
            onValueChange={(next) =>
              navigate({
                search: {
                  view: next === 'rules' ? undefined : (next as 'deliveries'),
                },
              })
            }
          >
            <TabList>
              <Tab value="rules">
                {t('overview.tabRules', { count: rules.length })}
              </Tab>
              <Tab value="deliveries">{t('overview.tabDeliveries')}</Tab>
            </TabList>
          </Tabs>
        }
      />
      <Page scroll={view === 'rules' && rules.length === 0}>
        {integrations.length === 0 ? (
          <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-border-brand bg-success-surface px-4 py-3">
            <Text variant="body">{t('overview.noChannelsTitle')}</Text>
            <Text variant="meta" tone="subtle">
              {t.rich('overview.noChannelsDescription', {
                link: (chunks) => (
                  <Link href={channelsHref} className="text-fg underline">
                    {chunks}
                  </Link>
                ),
              })}
            </Text>
          </div>
        ) : null}
        {view === 'deliveries' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-panel">
            <QueryState
              query={history}
              placeholder={null}
              title={t('overview.loadFailed')}
            >
              {(deliveries) => (
                <HistoryTable
                  projectId={projectId}
                  history={deliveries}
                  ruleNames={new Map(rules.map((r) => [r.id, r.name]))}
                  ruleHref={(ruleId) => alertHref(projectId, ruleId)}
                />
              )}
            </QueryState>
          </div>
        ) : rules.length === 0 ? (
          <AlertStarters projectId={projectId} />
        ) : (
          <RulesTable
            projectId={projectId}
            rules={rules}
            integrations={integrations}
            busy={update.isPending}
            onToggle={toggle}
          />
        )}
      </Page>
    </div>
  );
}
