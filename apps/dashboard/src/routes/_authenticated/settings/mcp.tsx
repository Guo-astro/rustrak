import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { getMcpSettings, listConnections } from '@/features/mcp/api/queries';
import { ConnectedApps } from '@/features/mcp/ui/components/connected-apps';
import { McpSettings } from '@/features/mcp/ui/components/mcp-settings';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { SettingsHeader } from '@/shared/ui/components/settings-header';
import { useSessionUser } from '@/shared/ui/hooks/use-session-user';

export const Route = createFileRoute('/_authenticated/settings/mcp')({
  head: () => {
    const t = translator('settings');
    return {
      meta: [
        { title: t('mcp.meta.title') },
        { name: 'description', content: t('mcp.meta.description') },
      ],
    };
  },
  loader: async () => {
    const [settings, connections] = await Promise.all([
      getMcpSettings(),
      listConnections(),
    ]);
    return { settings, connections };
  },
  component: McpPage,
});

function McpPage() {
  const t = useTranslations('settings');
  const { settings, connections } = Route.useLoaderData();
  const user = useSessionUser();

  const connected = connections.success ? (
    <ConnectedApps initial={connections.data} />
  ) : (
    <LoadFailure
      error={connections.error}
      title={t('mcp.connected.loadFailed')}
      notFoundOnMissing={false}
    />
  );

  if (!settings.success) {
    return (
      <>
        <SettingsHeader
          title={t('mcp.title')}
          description={t('mcp.subtitle')}
        />
        <LoadFailure
          error={settings.error}
          title={t('mcp.loadFailed')}
          notFoundOnMissing={false}
        />
      </>
    );
  }

  return (
    <McpSettings
      initial={settings.data}
      isAdmin={user.role === 'admin'}
      connected={connected}
    />
  );
}
