import { PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getAlertRule, listIntegrations } from '@/features/alert/api/queries';
import { RuleEditor } from '@/features/alert/ui/components/rule-editor/rule-editor';
import { alertHref } from '@/features/alert/ui/components/rule-list';
import { getProjectEnvironments } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';
import { useRouter } from '@/shared/ui/hooks/use-router';

/** An alert's form, filled in; saving goes back to the alert. */
export const Route = createFileRoute(
  '/_authenticated/projects/$id/alerts/$ruleId/edit',
)({
  loader: ({ params }) => {
    const projectId = Number.parseInt(params.id, 10);
    return loadAll([
      getAlertRule(projectId, Number.parseInt(params.ruleId, 10)),
      listIntegrations(),
      getProjectEnvironments(projectId),
    ]);
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: translator('alerts')('overview.editMetaTitle', {
          name: loaderData?.success ? loaderData.data[0].name : '',
        }),
      },
    ],
  }),
  component: EditAlertPage,
});

function EditAlertPage() {
  const t = useTranslations('alerts');
  const { id } = Route.useParams();
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const projectId = Number.parseInt(id, 10);
  usePageTrail(
    loaded.success
      ? [
          {
            label: loaded.data[0].name,
            href: alertHref(projectId, loaded.data[0].id),
          },
          { label: t('overview.edit') },
        ]
      : [],
  );

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={t('overview.loadFailed')} />
    );
  }
  const [rule, integrations, environments] = loaded.data;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('overview.editTitle', { name: rule.name })} />
      <RuleEditor
        projectId={projectId}
        rule={rule}
        initialType={rule.alert_type}
        integrations={integrations}
        environments={environments}
        onSaved={() => router.push(alertHref(projectId, rule.id))}
        onCancel={() => router.push(alertHref(projectId, rule.id))}
      />
    </div>
  );
}
