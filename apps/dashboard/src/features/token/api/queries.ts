import { queryOptions } from '@tanstack/react-query';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';

export const tokenQueries = {
  all: () => ['tokens'] as const,
  /** Every token, masked. */
  list: () =>
    queryOptions({
      queryKey: [...tokenQueries.all(), 'list'],
      queryFn: ({ signal }) => orThrow(api().tokens.list({ signal })),
    }),
  /** One token with its full value (40-char hex), for the reveal and copy. */
  detail: (id: number) =>
    queryOptions({
      queryKey: [...tokenQueries.all(), 'detail', id],
      queryFn: ({ signal }) =>
        orThrow(api().tokens.get({ path: { id }, signal })),
    }),
};
