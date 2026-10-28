import type { AlertType } from '@rustrak/client';
import { PageHeader } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { listIntegrations } from '@/features/alert/api/queries';
import { alertTypes } from '@/features/alert/model/alert-types';
import { alertHref, alertsHref } from '@/features/alert/model/rule-summary';
import { RuleEditor } from '@/features/alert/ui/components/rule-editor/rule-editor';
import { getProjectEnvironments } from '@/features/project/api/queries';
import { translator } from '@/shared/i18n/intl';
import { loadAll } from '@/shared/lib/results';
import { searchOneOf } from '@/shared/lib/search-params';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { usePageTrail } from '@/shared/ui/hooks/use-page-trail';
import { useRouter } from '@/shared/ui/hooks/use-router';

const TYPES = alertTypes.map((a) => a.type);

/** A new alert; `?type=` picks the trigger it starts on. */
export const Route = createFileRoute('/_authenticated/projects/$id/alerts/new')(
  {
    validateSearch: (search: Record<string, unknown>) => ({
      type: searchOneOf(search.type, TYPES),
    }),
    head: () => ({
      meta: [{ title: translator('alerts')('overview.newMetaTitle') }],
    }),
    loader: ({ params }) => {
      const projectId = Number.parseInt(params.id, 10);
      return loadAll([listIntegrations(), getProjectEnvironments(projectId)]);
    },
    component: NewAlertPage,
  },
);

function NewAlertPage() {
  const t = useTranslations('alerts');
  const { id } = Route.useParams();
  const { type } = Route.useSearch();
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const projectId = Number.parseInt(id, 10);
  usePageTrail([{ label: t('overview.new') }]);

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={t('overview.loadFailed')} />
    );
  }
  const [integrations, environments] = loaded.data;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('overview.new')}
        summary={[t('overview.newSummary')]}
      />
      <RuleEditor
        projectId={projectId}
        rule={null}
        initialType={(type ?? 'new_issue') as AlertType}
        integrations={integrations}
        environments={environments}
        onSaved={(rule) => router.push(alertHref(projectId, rule.id))}
        onCancel={() => router.push(alertsHref(projectId))}
      />
    </div>
  );
}
