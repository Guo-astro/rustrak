import type { Result, RustrakError } from '@rustrak/client';
import {
  MutationCache,
  QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

/**
 * A failed `Result`, thrown.
 *
 * `@rustrak/client` reports failures as values, and TanStack Query reads a
 * failure from a rejected promise: this is the one seam between the two. The
 * `RustrakError` travels whole in `error`, so whatever renders the failure
 * (`LoadFailure`, a form's field errors) reads the same union it always did.
 *
 * An `Error`, not the bare union, so the router's error boundary, the devtools
 * and a stack trace all see what any thrown value should be.
 */
export class ApiError extends Error {
  readonly error: RustrakError;

  constructor(error: RustrakError) {
    super(error.message);
    this.name = 'ApiError';
    this.error = error;
  }
}

/**
 * A client call's data, or its failure thrown as an {@link ApiError}: what a
 * `queryFn` or a `mutationFn` returns.
 */
export async function orThrow<T>(
  pending: Promise<Result<T, RustrakError>>,
): Promise<T> {
  const result = await pending;
  if (!result.success) throw new ApiError(result.error);
  return result.data;
}

declare module '@tanstack/react-query' {
  interface Register {
    // Every queryFn and mutationFn goes through `orThrow`.
    defaultError: ApiError;
    mutationMeta: {
      /** The queries the mutation changed, refetched once it settles. */
      invalidates?: readonly QueryKey[];
    };
  }
}

/**
 * How long a read counts as current. Within it, going back to a page shows
 * what it showed without asking again; past it, the page still shows that
 * at once and refetches behind it. Short, because what an error tracker shows
 * changes by the second.
 */
const STALE_TIME_MS = 30_000;

/**
 * The application's one cache.
 *
 * - **No retries here.** `@rustrak/client` already retries the failures a
 *   retry can fix (a 5xx, a 408, a dropped connection) with backoff; retrying
 *   on top would multiply them, and a 404 or a 403 never fixes itself.
 * - **A mutation names what it changed** in `meta.invalidates` and the cache
 *   refetches it once it settles, success or not (a failed write may still
 *   have written some of it). The mutation's promise waits for those
 *   refetches, so whatever follows it sees the new data.
 */
export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: false },
    },
    mutationCache: new MutationCache({
      onSettled: (_data, _error, _variables, _context, mutation) => {
        const keys = mutation.meta?.invalidates;
        if (!keys) return;
        return Promise.all(
          keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      },
    }),
  });
  return queryClient;
}
