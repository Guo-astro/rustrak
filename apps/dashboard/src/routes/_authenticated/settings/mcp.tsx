import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { mcpQueries } from '@/features/mcp/api/queries';
import { ConnectedApps } from '@/features/mcp/ui/components/connected-apps';
import { McpSettings } from '@/features/mcp/ui/components/mcp-settings';
import { translator } from '@/shared/i18n/intl';
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
  // Whether the server is on is the page; who is connected arrives after.
  loader: async ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(mcpQueries.connections());
    await queryClient.query({ ...mcpQueries.settings(), staleTime: 'static' });
  },
  component: McpPage,
});

function McpPage() {
  const { data: settings } = useSuspenseQuery(mcpQueries.settings());
  const user = useSessionUser();
  return (
    <McpSettings
      settings={settings}
      isAdmin={user.role === 'admin'}
      connected={<ConnectedApps />}
    />
  );
}
