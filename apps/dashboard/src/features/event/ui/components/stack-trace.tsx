import { useTranslations } from 'use-intl';
import {
  type ExceptionChain,
  orderFramesForDisplay,
} from '@/features/event/lib/format-stack-trace';
import { type FrameSourceUrl, StackFrameItem } from './stack-frame-item';

interface StackTraceProps {
  exception?: ExceptionChain;
  platform?: string;
  sourceUrl?: FrameSourceUrl;
}

export function StackTrace({
  exception,
  platform,
  sourceUrl,
}: StackTraceProps) {
  const t = useTranslations('events');
  const exceptions = exception?.values ?? [];

  if (exceptions.length === 0) {
    return (
      <div className="py-12 text-center text-meta text-fg-subtle">
        {t('stackTrace.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {exceptions.map((exc, i) => {
        const originalFrames = exc.stacktrace?.frames ?? [];
        const displayFrames = orderFramesForDisplay(originalFrames, platform);
        return (
          // An exception chain read once off a stored event. It has no id, and
          // `type` repeats across a chain that rethrows the same class, so the
          // position is the only thing that identifies a link. The list never
          // reorders or filters: a different event is a different route.
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
          <div key={i} className="space-y-4">
            {/* Exception Header */}
            <div className="flex flex-col gap-1">
              <h3 className="font-mono text-section text-sev-error-fg">
                {exc.type}
              </h3>
              <p className="font-mono text-mono text-fg-secondary">
                {exc.value}
              </p>
            </div>

            {/* Frames */}
            {displayFrames.length > 0 && (
              // One list, not a stack of cards: frames are lines of one
              // trace, and a rule between them is all the separation needed.
              <div className="divide-y divide-border-divider overflow-hidden rounded-lg border border-border-subtle">
                {displayFrames.map((frame) => {
                  const originalIdx = originalFrames.indexOf(frame);
                  return (
                    <StackFrameItem
                      key={originalIdx}
                      frame={frame}
                      index={originalIdx + 1}
                      sourceUrl={sourceUrl}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
