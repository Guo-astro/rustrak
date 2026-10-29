import { StorageIcon } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { storageQueries } from '@/features/storage/api/queries';
import { StorageView } from '@/features/storage/ui/components/storage-view';
import { session } from '@/shared/api/session';
import { translator } from '@/shared/i18n/intl';
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
  /**
   * Only for an admin: anyone else gets a 403 from every read here, under a
   * "not authorised" panel that already explains why.
   *
   * The retention is awaited: it answers at once and brings up the header and
   * its actions. The figures can take seconds and fill in their own panels.
   */
  loader: async ({ context: { queryClient } }) => {
    const answer = session.peek();
    if (answer?.state !== 'authenticated' || answer.user.role !== 'admin') {
      return;
    }
    void queryClient.prefetchQuery(storageQueries.summary());
    void queryClient.prefetchQuery(storageQueries.projects());
    void queryClient.prefetchQuery(storageQueries.age());
    await queryClient.query({
      ...storageQueries.retention(),
      staleTime: 'static',
    });
  },
  component: StoragePage,
});

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
        <SettingsHeader
          title={t('storage.title')}
          description={t('storage.subtitle')}
        />
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

  // The header is the view's: its actions need the view's state.
  return (
    <StorageView title={t('storage.title')} subtitle={t('storage.subtitle')} />
  );
}
