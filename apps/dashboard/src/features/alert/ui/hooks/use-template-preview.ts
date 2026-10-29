import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { alertQueries } from '@/features/alert/api/queries';

/**
 * What the body renders to, as the server sees it.
 *
 * `rendering` keeps the last answer on screen while the next one is on its
 * way, so the panel does not flash empty between keystrokes. `error` carries
 * the server's reason, which the editor also underlines; `unavailable` is a
 * request that failed rather than a template that would.
 */
export type TemplatePreview =
  | { status: 'idle' }
  | { status: 'rendering'; rendered?: string }
  | { status: 'ok'; rendered: string }
  | { status: 'error'; error: string; rendered?: string }
  | { status: 'unavailable'; rendered?: string };

/** Long enough to skip the keystrokes inside a word, short enough to feel live. */
const DEBOUNCE_MS = 350;

/**
 * How long the text has to have been still before a refusal is shown. A body
 * is broken for most of the time it is being typed (`{{ iss` is not a
 * template yet), and a red panel that flashes on every pause inside a word
 * reads as the editor arguing. A success is shown as soon as it arrives.
 */
const ERROR_SETTLE_MS = 800;

/** `value`, once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * What `template` renders to, asked of the server a little after the reader
 * stops typing. The dashboard cannot run the template engine, and a preview
 * from anywhere else would eventually disagree with what a delivery sends.
 *
 * Keyed by the template, so an answer for older text never stands for the
 * current one, and going back to a body already rendered asks nothing.
 */
export function useTemplatePreview(template: string): TemplatePreview {
  const debounced = useSettled(template, DEBOUNCE_MS);
  const settled = useSettled(template, ERROR_SETTLE_MS);
  const preview = useQuery({
    ...alertQueries.templatePreview(debounced),
    enabled: debounced.trim() !== '',
  });

  // The last body that rendered, kept for the panel while the next one is
  // asked or refused.
  const [rendered, setRendered] = useState<string>();
  const answer = preview.data;
  const ok = answer?.ok && answer.rendered != null ? answer.rendered : null;
  if (ok !== null && ok !== rendered) setRendered(ok);

  if (!template.trim()) return { status: 'idle' };
  if (debounced !== template || preview.isPending) {
    return { status: 'rendering', rendered };
  }
  if (ok !== null) return { status: 'ok', rendered: ok };
  if (settled !== template) return { status: 'rendering', rendered };
  if (preview.isError) return { status: 'unavailable', rendered };
  return { status: 'error', error: answer?.error ?? '', rendered };
}
