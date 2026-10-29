import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from '@tanstack/react-router';

/**
 * Everything above routing.
 *
 * Deliberately thin. The providers a Next root layout carried — the theme, the
 * toaster and the message catalogue — are mounted in `main.tsx` instead,
 * *outside* the router, because none of them may be torn down and rebuilt by a
 * navigation. A theme provider under the router would re-read `localStorage`
 * on a route change and a toast raised by a mutation would be unmounted by the
 * navigation that mutation triggered.
 *
 * `<HeadContent />` is what makes `head` on a route reach the document. It is
 * the browser tab's title and nothing else here: there is no crawler to serve,
 * because there is no page in this application that is not behind a login.
 *
 * The context carries the one `QueryClient`, so every loader reads and fills
 * the same cache the components subscribe to.
 */
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
