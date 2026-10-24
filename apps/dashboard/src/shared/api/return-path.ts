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

/** Where a sign-in should return to, as the router's guards use it. */
export interface ReturnPathStore {
  /** Leave `href`, a location's path, search and hash, for `/` to resume. */
  remember(href: string): void;
  /** Reads the stored address once, if it is one `/` may follow. */
  take(): string | undefined;
}

type ReturnPathStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The store, over any storage.
 *
 * `storage` is read on every call rather than once, because merely touching
 * `sessionStorage` throws where the browser refuses it (private mode, blocked
 * site data). Either way signing in lands on the projects list instead, which
 * is what it did before there was anywhere to return to.
 */
export function createReturnPathStore(
  storage: () => ReturnPathStorage,
): ReturnPathStore {
  return {
    remember(href) {
      try {
        storage().setItem(RETURN_PATH_KEY, href);
      } catch {
        // Refused: see above. A spent quota refuses the write but still holds
        // the address an earlier page left, and following that one would be
        // worse than following none.
        try {
          storage().removeItem(RETURN_PATH_KEY);
        } catch {
          // Nothing could have been stored to read back either.
        }
      }
    },

    take() {
      try {
        const store = storage();
        const stored = store.getItem(RETURN_PATH_KEY);
        store.removeItem(RETURN_PATH_KEY);
        return resumablePath(stored);
      } catch {
        return undefined;
      }
    },
  };
}

/** The application's return path, in this tab's `sessionStorage`. */
export const returnPath = createReturnPathStore(() => sessionStorage);

const ORIGIN = 'http://rustrak.invalid';

/**
 * The stored address, if it is one the app may resume.
 *
 * Only a path on this origin qualifies, and it comes back as the URL parser
 * read it, so what `/` follows is what was checked. `//host/x` and `/\host/x`
 * both parse to another host, and following either would turn `/` into an
 * open redirect.
 *
 * The normalised path is checked as well as the origin: `/.//host/x` stays on
 * this origin while it is parsed, but dot-segment removal leaves the path
 * `//host/x`, which the browser then reads as another host.
 */
export function resumablePath(
  stored: string | null | undefined,
): string | undefined {
  if (!stored?.startsWith('/')) return undefined;

  try {
    const url = new URL(stored, ORIGIN);
    if (url.origin !== ORIGIN) return undefined;
    const path = url.pathname + url.search + url.hash;
    return /^\/(?![/\\])/.test(path) ? path : undefined;
  } catch {
    return undefined;
  }
}
