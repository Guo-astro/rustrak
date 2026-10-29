/**
 * Writes about people and their access.
 *
 * The sign-in writes publish the user they are handed to the session store
 * themselves: the response already carries it, and a second `/auth/me` to
 * learn what we were just told is a round trip the login screen pays for.
 * No cookie handling anywhere: the request is same-origin, so the browser
 * stores the session cookie itself.
 */
import type {
  AcceptInvitation,
  CreateInvitation,
  LoginRequest,
  UpsertProjectMember,
  UserRole,
} from '@rustrak/client';
import { mutationOptions } from '@tanstack/react-query';
import { orThrow } from '@/shared/api/query';
import { api } from '@/shared/api/rustrak';
import { session } from '@/shared/api/session';
import { userQueries } from './queries';

export const userMutations = {
  /**
   * The server answers the same `unauthenticated` whether the email is
   * unknown, the password wrong or the account disabled; giving that one
   * deliberately vague sentence is the form's decision (`login-form.tsx`).
   */
  login: () =>
    mutationOptions({
      mutationFn: async (credentials: LoginRequest) => {
        const { user } = await orThrow(api().auth.login({ body: credentials }));
        session.set({ state: 'authenticated', user });
        return user;
      },
    }),
  /** Start OIDC login; resolves to the URL to send the browser to. */
  startSso: () =>
    mutationOptions({
      mutationFn: async () =>
        (await orThrow(api().auth.ssoStart())).authorization_url,
    }),
  /** Link the pending SSO identity with the account's password and sign in. */
  confirmSsoLink: () =>
    mutationOptions({
      mutationFn: async (password: string) => {
        const { user } = await orThrow(
          api().auth.confirmSsoLink({ body: { password } }),
        );
        session.set({ state: 'authenticated', user });
        return user;
      },
      meta: { invalidates: [userQueries.ssoLink().queryKey] },
    }),
  /**
   * The session this tab holds is dropped whether or not the request lands,
   * and a failed request is not reported: dropping it is not a claim that the
   * server session ended (the next guard asks and gets the truth), it is a
   * refusal to keep rendering the dashboard, the safer of the two failures on
   * a shared machine.
   */
  logout: () =>
    mutationOptions({
      mutationFn: async () => {
        try {
          await api().auth.logout();
        } finally {
          session.clear();
        }
      },
    }),
  /**
   * Accept an invitation by setting a password. The server signs the new
   * account in unless password login is disabled; then `signed_in` is false,
   * the user signs in through SSO, and the server has also ended any session
   * this browser had, so the store must not keep showing that other account.
   */
  acceptInvitation: () =>
    mutationOptions({
      mutationFn: async (input: AcceptInvitation) => {
        const accepted = await orThrow(
          api().auth.acceptInvitation({ body: input }),
        );
        if (accepted.signed_in) {
          session.set({ state: 'authenticated', user: accepted.user });
        } else {
          session.clear();
        }
        return accepted;
      },
      meta: {
        invalidates: [
          userQueries.invitationsRoot(),
          userQueries.team().queryKey,
        ],
      },
    }),
  /**
   * The reader's language and timezone. A field left out is left alone; a
   * field sent as `null` is cleared, back to "infer it from my browser".
   *
   * The updated user goes to the session store, which is not a query and so
   * not something `meta.invalidates` can reach: the row is only read at boot,
   * and without this `intl.reload()` would resolve straight back to the
   * language the reader just changed away from.
   */
  updatePreferences: () =>
    mutationOptions({
      mutationFn: async (preferences: {
        language?: string | null;
        timezone?: string | null;
      }) => {
        const user = await orThrow(
          api().auth.updateCurrentUser({ body: preferences }),
        );
        session.set({ state: 'authenticated', user });
      },
    }),
  /** Replace the signed-in user's password, given the current one. */
  changePassword: () =>
    mutationOptions({
      mutationFn: (request: {
        current_password: string;
        new_password: string;
      }) => orThrow(api().auth.changePassword({ body: request })),
    }),
  /**
   * A user's global role. The server refuses to demote the last admin and
   * names `role` on what it can attribute, so the failure reaches the control.
   */
  updateRole: (userId: number) =>
    mutationOptions({
      mutationFn: (role: UserRole) =>
        orThrow(
          api().team.updateRole({ path: { user_id: userId }, body: { role } }),
        ),
      meta: { invalidates: [userQueries.team().queryKey] },
    }),
  /**
   * Remove a user from the instance; the server refuses yourself, the primary
   * user and the last admin. Their memberships go with them, in every project.
   */
  removeFromTeam: (userId: number) =>
    mutationOptions({
      mutationFn: () =>
        orThrow(api().team.deleteUser({ path: { user_id: userId } })),
      meta: { invalidates: [userQueries.team().queryKey, ['projects']] },
    }),
  /**
   * Add a member to a project or change their role (upsert by `user_id`). The
   * server names `role` on a rejected role.
   */
  upsertMember: (projectId: number) =>
    mutationOptions({
      mutationFn: (input: UpsertProjectMember) =>
        orThrow(
          api().members.upsert({
            path: { project_id: projectId },
            body: input,
          }),
        ),
      meta: { invalidates: [userQueries.members(projectId).queryKey] },
    }),
  removeMember: (projectId: number, userId: number) =>
    mutationOptions({
      mutationFn: () =>
        orThrow(
          api().members.remove({
            path: { project_id: projectId, user_id: userId },
          }),
        ),
      meta: { invalidates: [userQueries.members(projectId).queryKey] },
    }),
  /**
   * Invite an email with a role. No email is sent: the token builds the link
   * the admin shares. An address that already has an account or an invite
   * comes back as a `conflict` naming `email`, for the email input.
   */
  invite: () =>
    mutationOptions({
      mutationFn: (input: CreateInvitation) =>
        orThrow(api().invitations.create({ body: input })),
      meta: { invalidates: [userQueries.invitations().queryKey] },
    }),
  revokeInvitation: (token: string) =>
    mutationOptions({
      mutationFn: () => orThrow(api().invitations.revoke({ path: { token } })),
      meta: { invalidates: [userQueries.invitationsRoot()] },
    }),
};
