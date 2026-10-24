/**
 * Where a signed-out reader was going, held across a sign-in.
 *
 * Every way in lands on `/` afterwards: the password form pushes it, and the
 * server sends both SSO and SSO's account-linking step there once the
 * provider answers. A `?redirect=` on `/login` would not survive the SSO
 * round trip, which leaves the SPA for the identity provider and comes back
 * through a server redirect. So a page that sends the reader to `/login`
 * leaves its own address in `sessionStorage`, and `/` resumes it.
 *
 * `sessionStorage` is per tab, which is the scope this wants: the tab that
 * followed the link from Slack or an alert email is the tab that signs in.
 */
const RETURN_PATH_KEY = 'rustrak.returnPath';

/** Leave `href`, a location's path, search and hash, for `/` to resume. */
export function rememberReturnPath(href: string): void {
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, href);
  } catch {
    // Storage refused (private mode): signing in lands on the projects list
    // instead, which is what it did before there was anywhere to return to.
  }
}

/** Reads the stored address once, if it is one `/` may follow. */
export function takeReturnPath(): string | undefined {
  try {
    const stored = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return resumablePath(stored);
  } catch {
    return undefined;
  }
}

const ORIGIN = 'http://rustrak.invalid';

/**
 * The stored address, if it is one the app may resume.
 *
 * Only a path on this origin qualifies, and it comes back as the URL parser
 * read it, so what `/` follows is what was checked. `//host/x` and `/\host/x`
 * both parse to another host, and following either would turn `/` into an
 * open redirect.
 */
export function resumablePath(
  stored: string | null | undefined,
): string | undefined {
  if (!stored?.startsWith('/')) return undefined;

  try {
    const url = new URL(stored, ORIGIN);
    if (url.origin !== ORIGIN) return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
