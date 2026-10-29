/**
 * Whether the URL is a settings page: the instance's or any project's. A
 * project's alert rules live under its settings but are reached from Monitor,
 * so they keep the project's sidebar.
 *
 * The path alone decides. The location moves as soon as a navigation starts,
 * before the project's loader has answered, and waiting on the project made
 * the sidebar leave settings for a frame and slide back in.
 */
export function isSettingsPath(pathname: string): boolean {
  return /^\/settings(\/|$)|^\/projects\/[^/]+\/settings(?!\/alerts)(\/|$)/.test(
    pathname,
  );
}
