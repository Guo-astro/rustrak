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
import { createFileRoute } from '@tanstack/react-router';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { updateAlertRule } from '@/features/alert/api/mutations';
import {
  listAlertHistory,
  listAlertRules,
  listIntegrations,
} from '@/features/alert/api/queries';
import { HistoryTable } from '@/features/alert/ui/components/alert-history';
import {
  AlertStarters,
  alertHref,
  newAlertHref,
  RulesTable,
} from '@/features/alert/ui/components/rule-list';
import { getProject } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf } from '@/shared/lib/search-params';
import { Link } from '@/shared/ui/components/link';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { useRouter } from '@/shared/ui/hooks/use-router';

const VIEWS = ['rules', 'deliveries'] as const;

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
  // The lists used to fall back to `[]`, which drew "no alert rules yet" over
  // an outage and invited the admin to recreate rules that already exist.
  loader: ({ params }) => {
    const projectId = Number.parseInt(params.id, 10);
    return loadAll([
      getProject(projectId),
      listAlertRules(projectId),
      listIntegrations(),
      listAlertHistory(projectId, { limit: 100 }),
    ]);
  },
  component: AlertsPage,
});

function AlertsPage() {
  const t = useTranslations('alerts');
  const { id } = Route.useParams();
  const { view = 'rules' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const projectId = Number.parseInt(id, 10);

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={t('overview.loadFailed')} />
    );
  }

  const [project, rules, integrations, history] = loaded.data;
  const active = rules.filter((r) => r.is_enabled).length;
  const failed = history.filter((h) => h.status === 'failed').length;
  const channelsHref = `/settings/integrations?projectId=${projectId}`;

  const toggle = (rule: AlertRuleResponse, enabled: boolean) =>
    startTransition(async () => {
      const result = await updateAlertRule(projectId, rule.id, {
        is_enabled: enabled,
      });
      if (!result.success) {
        toast.error(t('ruleDialog.saveFailed'), {
          description: result.error.message,
        });
        return;
      }
      toast.success(t(enabled ? 'list.resumed' : 'list.pausedToast'));
      await router.refresh();
    });

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
            <HistoryTable
              projectId={projectId}
              history={history}
              ruleNames={new Map(rules.map((r) => [r.id, r.name]))}
              ruleHref={(ruleId) => alertHref(projectId, ruleId)}
            />
          </div>
        ) : rules.length === 0 ? (
          <AlertStarters projectId={projectId} />
        ) : (
          <RulesTable
            projectId={projectId}
            rules={rules}
            integrations={integrations}
            busy={isPending}
            onToggle={toggle}
          />
        )}
      </Page>
    </div>
  );
}
