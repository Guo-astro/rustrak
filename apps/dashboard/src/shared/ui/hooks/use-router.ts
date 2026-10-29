import {
  useNavigate,
  useRouter as useTanStackRouter,
} from '@tanstack/react-router';
import { useMemo } from 'react';

/**
 * The four things this application ever asked a router to do.
 *
 * It reads like `next/navigation`'s `useRouter` because it is the same four
 * calls at the same forty call sites; only what happens underneath changed.
 * Keeping the shape meant the framework move touched the import line of those
 * files and nothing else, which is the difference between a diff a reviewer
 * can read and one they can only trust.
 */
export interface AppRouter {
  push(href: string): void;
  replace(href: string): void;
  back(): void;
  /**
   * Re-run the routes on screen: their loaders, which the query cache
   * answers, and their `head`. Never to see a write — the cache does that —
   * only for what lives outside it, like a tab title `head` translated.
   */
  refresh(): Promise<void>;
}

export function useRouter(): AppRouter {
  const navigate = useNavigate();
  const router = useTanStackRouter();

  return useMemo(
    () => ({
      push: (href: string) => {
        void navigate({ href });
      },
      replace: (href: string) => {
        void navigate({ href, replace: true });
      },
      back: () => {
        router.history.back();
      },
      refresh: () => router.invalidate(),
    }),
    [navigate, router],
  );
}
