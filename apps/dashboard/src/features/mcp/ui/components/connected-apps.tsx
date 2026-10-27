import type { OAuthGrant } from '@rustrak/client';
import { Avatar, Button, IntegrationsIcon } from '@rustrak/ui';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'use-intl';
import { revokeConnection } from '@/features/mcp/api/mutations';
import {
  SettingSection,
  SettingsEmpty,
  SettingsListItem,
} from '@/shared/ui/components/setting-row';

/** The host a client is published from, which is what a reader recognises. */
function clientHost(clientId: string): string {
  try {
    return new URL(clientId).host;
  } catch {
    return clientId;
  }
}

/**
 * The assistants connected to the reader's account by signing in, and the
 * one control that matters for each: cutting it off.
 */
export function ConnectedApps({ initial }: { initial: OAuthGrant[] }) {
  const t = useTranslations('settings');
  const format = useFormatter();
  const [grants, setGrants] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const revoke = (grant: OAuthGrant) => {
    startTransition(async () => {
      const result = await revokeConnection(grant.id);
      if (!result.success) {
        toast.error(t('mcp.connected.revokeFailed'), {
          description: result.error.message,
        });
        return;
      }
      setGrants((prev) => prev.filter((g) => g.id !== grant.id));
      toast.success(t('mcp.connected.revoked', { name: grant.client_name }));
    });
  };

  return (
    <SettingSection title={t('mcp.connected.title')}>
      {grants.length === 0 ? (
        <SettingsEmpty
          icon={<IntegrationsIcon size="2xl" />}
          title={t('mcp.connected.empty')}
        />
      ) : (
        grants.map((grant) => (
          <SettingsListItem
            key={grant.id}
            leading={<Avatar name={grant.client_name} shape="square" />}
            title={grant.client_name}
            description={
              <span className="font-mono text-mono">
                {clientHost(grant.client_id)}
              </span>
            }
            meta={format.dateTime(new Date(grant.created_at), 'date')}
            actions={
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() => revoke(grant)}
                aria-label={t('mcp.connected.revokeLabel', {
                  name: grant.client_name,
                })}
              >
                {t('mcp.connected.revoke')}
              </Button>
            }
          />
        ))
      )}
    </SettingSection>
  );
}
