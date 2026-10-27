import { ExternalLinkIcon } from '@rustrak/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { listTokens } from '@/features/token/api/queries';
import { TokensList } from '@/features/token/ui/components/tokens-list/tokens-list';
import { translator } from '@/shared/i18n/intl';
import { LoadFailure } from '@/shared/ui/components/load-failure';

export const Route = createFileRoute('/_authenticated/settings/tokens')({
  head: () => {
    const t = translator('settings');
    return {
      meta: [
        { title: t('tokens.meta.title') },
        { name: 'description', content: t('tokens.meta.description') },
      ],
    };
  },
  loader: () => listTokens(),
  component: TokensPage,
});

function TokensPage() {
  const t = useTranslations('settings');
  const tokens = Route.useLoaderData();

  if (!tokens.success) {
    return (
      <LoadFailure
        error={tokens.error}
        title={t('tokens.loadFailed')}
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <TokensList
      initialTokens={tokens.data}
      title={t('tokens.title')}
      subtitle={t('tokens.subtitle')}
      footer={
        <p className="mt-3 text-meta text-fg-subtle">
          {t('tokens.apiReferenceDescription')}{' '}
          <a
            href="https://rustrak.dev/api-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-fg-brand hover:underline"
          >
            {t('tokens.apiReference')}
            <ExternalLinkIcon size="sm" aria-hidden="true" />
          </a>
        </p>
      }
    />
  );
}
