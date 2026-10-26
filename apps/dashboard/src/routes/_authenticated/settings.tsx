import { Page } from '@rustrak/ui';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { translator } from '@/shared/i18n/intl';

export const Route = createFileRoute('/_authenticated/settings')({
  head: () => {
    const t = translator('settings');
    return {
      meta: [
        { title: `${t('nav.settingsTitle')} | Rustrak` },
        { name: 'description', content: t('meta.description') },
      ],
    };
  },
  component: SettingsLayout,
});

/**
 * The settings pages' frame: the scroller. The list of
 * pages is the sidebar's, which switches to its settings mode on these
 * routes, so there is no second menu in here.
 */
function SettingsLayout() {
  return (
    <div className="flex h-full flex-col">
      <Page>
        <Outlet />
      </Page>
    </div>
  );
}
