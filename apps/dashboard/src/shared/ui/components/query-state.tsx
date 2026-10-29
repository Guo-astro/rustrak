import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ApiError } from '@/shared/api/query';
import { LoadFailure } from '@/shared/ui/components/load-failure';

/**
 * A secondary read's three states: its placeholder until the first answer,
 * the failure in place of the panel, the data otherwise.
 *
 * Data wins over a later failure: a background refetch that fails leaves what
 * was on screen rather than replacing a chart with an error.
 */
export function QueryState<T>({
  query,
  placeholder,
  title,
  children,
}: {
  query: UseQueryResult<T, ApiError>;
  placeholder: ReactNode;
  /** Which read failed, when it does. */
  title: string;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return children(query.data);
  if (query.isError) {
    return (
      <LoadFailure
        error={query.error.error}
        title={title}
        notFoundOnMissing={false}
      />
    );
  }
  return placeholder;
}
