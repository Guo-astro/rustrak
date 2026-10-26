import type { LogsVolumeResponse } from '@rustrak/client';

/** The six levels, least severe first. */
export const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * The volume as bars of four bands. `fatal` folds into error and `trace`
 * into debug, as the overview's chart folds them: as bands of their own they
 * sit too close to their neighbour's colour to be told apart.
 */
export function volumeBars(points: LogsVolumeResponse) {
  return points.map((p) => ({
    t: Date.parse(p.bucket),
    debug: p.trace + p.debug,
    info: p.info,
    warn: p.warn,
    error: p.error + p.fatal,
  }));
}

/** `text` cut where it holds `query`, ignoring case, the matches marked. */
export function matchParts(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const haystack = text.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, from)
  ) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
