import type { Result, RetentionResponse, RustrakError } from '@rustrak/client';
import { StorageIcon } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'use-intl';
import {
  getRetention,
  getStorageAge,
  getStorageProjects,
  getStorageSummary,
} from '@/features/storage/api/queries';
import {
  type StorageFigures,
  StorageView,
} from '@/features/storage/ui/components/storage-view';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsEmpty } from '@/shared/ui/components/setting-row';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import { useSessionUser } from '@/shared/ui/hooks/use-session-user';

export const Route = createFileRoute('/_authenticated/settings/storage')({
  head: () => {
    const t = translator('settings');
    return {
      meta: [
        { title: t('storage.meta.title') },
        { name: 'description', content: t('storage.meta.description') },
      ],
    };
  },
  component: StoragePage,
});

function PageHeader() {
  const t = useTranslations('settings');

  return (
    <SettingsHeader
      title={t('storage.title')}
      description={t('storage.subtitle')}
    />
  );
}

function StoragePage() {
  const t = useTranslations('settings');
  // Resolved by the gate above. The "we could not ask" branch that used to sit
  // between these two is `_authenticated`'s now: telling a visitor "Not
  // authorized" when the truth is "we could not reach the API to find out" is
  // a lie about their permissions, and it is told in one place or none.
  const user = useSessionUser();

  // Guard: storage usage and cleanup are instance-admin only.
  if (user.role !== 'admin') {
    return (
      <>
        <PageHeader />
        <div className="rounded-2xl border border-border-subtle bg-surface">
          <SettingsEmpty
            icon={<StorageIcon size="2xl" />}
            title={t('notAuthorized')}
            description={t('storage.notAuthorizedDescription')}
          />
        </div>
      </>
    );
  }

  // The header is the view's: its action, retention, needs the view's state.
  return <StorageContent />;
}

/**
 * The retention and the figures, read apart: the retention answers at once
 * and brings up the header and its actions; the figures can take seconds and
 * fill in their own panels. `version` reads both again after a cleanup; the
 * last figures stay on screen meanwhile.
 */
function StorageContent() {
  const t = useTranslations('settings');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // The retention keeps the version it was read for. The view is keyed by it, so it starts afresh from the new retention rather than the
  // old one the moment a reload is asked for.
  const [retention, setRetention] = useState<{
    version: number;
    result: Result<RetentionResponse, RustrakError>;
  } | null>(null);
  const [figures, setFigures] = useState<
    { data: StorageFigures } | { error: RustrakError } | null
  >(null);
  // Not `useAsync`, which drops its answer while the next one loads. A
  // newer read wins; an older one is dropped.
  useEffect(() => {
    let live = true;
    void getRetention().then(
      (result) => live && setRetention({ version, result }),
    );
    void loadFigures().then((answer) => live && setFigures(answer));
    return () => {
      live = false;
    };
  }, [version]);

  if (retention === null) return <PageHeader />;
  if (!retention.result.success) {
    return (
      <>
        <PageHeader />
        <LoadFailure
          error={retention.result.error}
          title={t('storage.loadFailed')}
          notFoundOnMissing={false}
        />
      </>
    );
  }

  return (
    <StorageView
      key={retention.version}
      title={t('storage.title')}
      subtitle={t('storage.subtitle')}
      retention={retention.result.data}
      figures={figures}
      onChanged={reload}
    />
  );
}

async function loadFigures(): Promise<
  { data: StorageFigures } | { error: RustrakError }
> {
  const [summary, projects, age] = await Promise.all([
    getStorageSummary(),
    getStorageProjects(),
    getStorageAge(),
  ]);
  if (!summary.success) return { error: summary.error };
  if (!projects.success) return { error: projects.error };
  if (!age.success) return { error: age.error };
  return {
    data: { summary: summary.data, projects: projects.data, age: age.data },
  };
}
