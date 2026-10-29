import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { NotFoundScreen } from '@/shared/ui/components/not-found-screen';
import { RouteError } from '@/shared/ui/components/route-error';
import { routeTree } from './routeTree.gen';

/**
 * The router.
 *
 * `basepath` is left at `/` deliberately: the bundle is served from the root of
 * the server's origin, and a sub-path deployment would have to change this
 * *and* `base` in `vite.config.ts` together.
 */
export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    // A loader awaits what its page cannot paint without, so the router keeps
    // the old page rendered until that is in. `0` would flash the pending
    // component on a fast network, which is worse than waiting.
    defaultPendingMs: 300,
    defaultPendingMinMs: 300,
    // Hovering a link starts its reads. Whether a read is fresh enough to
    // skip is the query cache's decision, not the router's: with the router's
    // own 30s preload cache on top, a preload could hold a loader result that
    // the cache has since invalidated.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundScreen,
    defaultErrorComponent: RouteError,
    // Scroll restoration is what a browser does for a document and what a
    // client-routed application has to do for itself. Without it, following a
    // link from halfway down the issues list opens the issue halfway down.
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
