import { QueryBar, type QueryField } from '@rustrak/ui';
import { useTranslations } from 'use-intl';
import { LOG_LEVELS, type LogLevel } from '@/features/log/model/log-view';

export interface LogSearchValue {
  q?: string;
  level?: LogLevel;
  trace?: string;
}

/**
 * The logs' search bar: free text searches the message, `level:` keeps one
 * level and `trace:` one trace -- Sentry's syntax, so the habit carries over.
 */
export function LogSearch({
  value,
  onChange,
}: {
  value: LogSearchValue;
  onChange: (next: LogSearchValue) => void;
}) {
  const t = useTranslations('logs');

  const fields: QueryField[] = [
    {
      key: 'level',
      label: t('level'),
      variant: 'options',
      multiple: false,
      options: LOG_LEVELS.map((level) => ({
        value: level,
        label: t(`levels.${level}`),
      })),
    },
    { key: 'trace', label: t('trace'), variant: 'text' },
  ];

  return (
    <QueryBar
      className="min-w-0 max-sm:basis-full"
      fields={fields}
      filters={[
        ...(value.level ? [{ id: 'level', value: [value.level] }] : []),
        ...(value.trace ? [{ id: 'trace', value: value.trace }] : []),
      ]}
      search={value.q ?? ''}
      placeholder={t('search')}
      onChange={(next) => {
        const level = next.filters.find((f) => f.id === 'level')?.value;
        const trace = next.filters.find((f) => f.id === 'trace')?.value;
        onChange({
          q: next.search.trim() || undefined,
          level: Array.isArray(level)
            ? LOG_LEVELS.find((l) => l === level[0])
            : undefined,
          trace: typeof trace === 'string' && trace ? trace : undefined,
        });
      }}
    />
  );
}
