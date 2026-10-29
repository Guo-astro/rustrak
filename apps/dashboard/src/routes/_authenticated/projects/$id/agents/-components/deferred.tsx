import type { Result, RustrakError } from '@rustrak/client';
import { Await } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { LoadFailure } from '@/shared/ui/components/load-failure';

/**
 * One panel's read, returned unawaited by the loader: the page paints without
 * it, the panel holds a placeholder until it lands, and a failure stays in the
 * panel. A loader awaiting every panel made the page as slow as the slowest
 * one, and one failure took the whole page down.
 */
export function Deferred<T>({
  promise,
  height,
  title,
  children,
}: {
  promise: Promise<Result<T, RustrakError>>;
  height: number;
  /** Which read failed, when it does. */
  title: string;
  children: (data: T) => ReactNode;
}) {
  return (
    <Await
      promise={promise}
      fallback={
        <div
          className="w-full animate-pulse rounded-lg bg-surface-hover motion-reduce:animate-none"
          style={{ height }}
        />
      }
    >
      {(result) =>
        result.success ? (
          children(result.data)
        ) : (
          <LoadFailure
            error={result.error}
            title={title}
            notFoundOnMissing={false}
          />
        )
      }
    </Await>
  );
}
