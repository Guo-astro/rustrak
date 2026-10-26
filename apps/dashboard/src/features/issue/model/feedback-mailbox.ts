/**
 * Sentry's three feedback mailboxes, each an issue status: Spam is a muted
 * (`ignored`) feedback, as in Sentry's own UI.
 */
export const MAILBOXES = ['inbox', 'resolved', 'spam'] as const;
export type Mailbox = (typeof MAILBOXES)[number];

/** The issue list filter a mailbox reads. */
export const MAILBOX_FILTER = {
  inbox: 'open',
  resolved: 'resolved',
  spam: 'muted',
} as const satisfies Record<Mailbox, string>;

/** Who sent it, by the most personal thing they gave; empty if nothing. */
export function feedbackSender(feedback: {
  name: string;
  contact_email: string;
}): string {
  return feedback.name || feedback.contact_email;
}

/** A page address without its scheme, which every row would repeat. */
export function shortUrl(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, '');
}

/**
 * Which row the inbox opens after `id` leaves it -- resolved or sent to
 * spam -- so triage carries on down the list: the next one, or the one
 * before when it was the last.
 */
export function nextAfter(ids: string[], id: string): string | undefined {
  const index = ids.indexOf(id);
  if (index === -1) return undefined;
  return ids[index + 1] ?? ids[index - 1];
}
