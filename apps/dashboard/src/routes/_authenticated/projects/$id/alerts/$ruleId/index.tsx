import { Button, DeleteIcon, EditIcon, Switch } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'use-intl';
import {
  deleteAlertRule,
  updateAlertRule,
} from '@/features/alert/api/mutations';
import {
  getAlertHistoryByDay,
  getAlertRule,
  listAlertHistory,
  listIntegrations,
} from '@/features/alert/api/queries';
import {
  alertHref,
  alertsHref,
  ruleShape,
} from '@/features/alert/model/rule-summary';
import {
  HistoryChart,
  HistoryTable,
} from '@/features/alert/ui/components/alert-history';
import { AlertTypeIcon } from '@/features/alert/ui/components/alert-type-icon';
import { ConfirmDeleteDialog } from '@/features/alert/ui/components/confirm-delete-dialog';
import { ProviderIcon } from '@/features/alert/ui/components/provider-icon';
import { useFrequency } from '@/features/alert/ui/components/rule-list';
import { RuleSentence } from '@/features/alert/ui/components/rule-sentence';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { Link } from '@/shared/ui/components/link';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { Panel, RailBlock } from '@/shared/ui/components/panel';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';
import { useRouter } from '@/shared/ui/hooks/use-router';

/**
 * One alert, laid out as the endpoint and monitor pages are: what it is and
 * what can be done to it in the header, what it has sent in the reading
 * column -- per day, then delivery by delivery with the reason for every
 * failure and skip -- and how it is set up in the rail.
 */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/alerts/$ruleId/',
)({
  loader: ({ params }) => {
    const projectId = Number.parseInt(params.id, 10);
    const ruleId = Number.parseInt(params.ruleId, 10);
    return loadAll([
      getAlertRule(projectId, ruleId),
      listIntegrations(),
      listAlertHistory(projectId, { ruleId, limit: 100 }),
      // Counted on the server: the table above is only the newest page.
      getAlertHistoryByDay(projectId, { ruleId, days: 14 }),
    ]);
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: translator('alerts')('overview.ruleMetaTitle', {
          name: loaderData?.success ? loaderData.data[0].name : '',
        }),
      },
    ],
  }),
  component: AlertPage,
});

function AlertPage() {
  const t = useTranslations('alerts');
  const format = useFormatter();
  const frequency = useFrequency();
  const { id } = Route.useParams();
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const projectId = Number.parseInt(id, 10);
  usePageTrail(loaded.success ? [{ label: loaded.data[0].name }] : []);

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={t('overview.loadFailed')} />
    );
  }

  const [rule, integrations, history, days] = loaded.data;
  const shape = ruleShape(rule, integrations);
  const linked = new Set(rule.integration_ids);
  const channels = integrations.filter((i) => linked.has(i.id));
  const count = (status: 'sent' | 'skipped' | 'failed') =>
    days.reduce((sum, day) => sum + day[status], 0);

  const setEnabled = (enabled: boolean) =>
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

  const remove = () =>
    startTransition(async () => {
      const result = await deleteAlertRule(projectId, rule.id);
      if (!result.success) {
        toast.error(t('overview.deleteFailed'), {
          description: result.error.message,
        });
        return;
      }
      toast.success(t('overview.deleted'));
      setConfirming(false);
      router.push(alertsHref(projectId));
    });

  const figures: [string, ReactNode][] = [
    [
      t('history.lastTriggered'),
      rule.last_triggered_at
        ? format.relativeTime(new Date(rule.last_triggered_at))
        : '—',
    ],
    [t('history.status.sent'), format.number(count('sent'))],
    [t('history.status.skipped'), format.number(count('skipped'))],
    [
      t('history.status.failed'),
      <span
        key="failed"
        className={count('failed') ? 'text-sev-error-fg' : undefined}
      >
        {format.number(count('failed'))}
      </span>,
    ],
  ];

  const facts: [string, ReactNode][] = [
    [
      t('table.when'),
      <span key="when" className="inline-flex items-center gap-1.5">
        <AlertTypeIcon
          type={rule.alert_type}
          className="size-3.5 text-fg-subtle"
        />
        {t(`types.${rule.alert_type}.name`)}
      </span>,
    ],
    [
      t('editor.environments'),
      shape.environments.length
        ? shape.environments.join(', ')
        : t('editor.allEnvironments'),
    ],
    ...(rule.alert_type === 'new_feedback'
      ? []
      : ([
          [
            t('editor.level'),
            shape.minLevel === 'any'
              ? t('editor.anyLevel')
              : t('editor.levelOrHigher', { level: shape.minLevel }),
          ],
        ] as [string, ReactNode][])),
    ...(rule.alert_type === 'new_issue'
      ? ([[t('editor.minEvents'), format.number(shape.minEvents)]] as [
          string,
          ReactNode,
        ][])
      : []),
    [t('table.frequency'), frequency(rule.cooldown_minutes)],
    [
      t('detail.created'),
      <span
        key="created"
        title={format.dateTime(new Date(rule.created_at), 'dateTime')}
      >
        {format.relativeTime(new Date(rule.created_at))}
      </span>,
    ],
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="@container shrink-0 border-border-divider border-b px-page-gutter pt-6 pb-5">
        <div className="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between @4xl:gap-8">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-fg text-page-title">{rule.name}</h1>
            <p className="max-w-3xl text-body text-fg-secondary leading-relaxed">
              <RuleSentence rule={shape} />
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="me-2 flex items-center gap-2 text-fg-secondary text-meta">
              <Switch
                checked={rule.is_enabled}
                disabled={isPending}
                onCheckedChange={setEnabled}
              />
              {t(rule.is_enabled ? 'overview.active' : 'list.paused')}
            </label>
            <Button
              icon={EditIcon}
              render={<Link href={`${alertHref(projectId, rule.id)}/edit`} />}
            >
              {t('overview.edit')}
            </Button>
            <Button
              variant="ghost"
              icon={DeleteIcon}
              disabled={isPending}
              onClick={() => setConfirming(true)}
            >
              {t('overview.delete')}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="flex flex-col gap-5 px-page-gutter pt-5 pb-8">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle xl:grid-cols-4">
              {figures.map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col gap-1.5 bg-surface px-4 py-3.5"
                >
                  <dt className="truncate text-fg-meta text-meta">{label}</dt>
                  <dd className="text-fg text-title tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <Panel title={t('history.last14')} hint={t('history.chartHint')}>
              <HistoryChart days={days} />
            </Panel>
            <Panel
              flush
              title={t('history.title')}
              hint={t('history.ruleHint')}
            >
              <HistoryTable projectId={projectId} history={history} />
            </Panel>
          </div>
        </main>
        <aside className="border-border-divider bg-panel max-lg:border-t lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l xl:w-88">
          <RailBlock title={t('detail.setup')}>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-meta">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd className="min-w-0 text-right text-fg-secondary">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </RailBlock>
          <RailBlock title={t('table.notifies')}>
            <ul className="flex flex-col gap-2.5 text-meta">
              {channels.map((channel) => (
                <li key={channel.id} className="flex items-center gap-2">
                  <ProviderIcon
                    type={channel.provider_type}
                    className="size-3.5 shrink-0 text-fg-subtle"
                  />
                  <span className="min-w-0 flex-1 truncate text-fg-secondary">
                    {channel.name}
                  </span>
                  {channel.last_failure_at &&
                  (!channel.last_success_at ||
                    channel.last_failure_at > channel.last_success_at) ? (
                    <span
                      className="shrink-0 text-sev-error-fg"
                      title={channel.last_failure_message ?? undefined}
                    >
                      {t('detail.channelFailing')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </RailBlock>
        </aside>
      </div>

      <ConfirmDeleteDialog
        open={confirming}
        title={t('overview.deleteTitle', { name: rule.name })}
        description={t('overview.deleteDescription')}
        isPending={isPending}
        onConfirm={remove}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
