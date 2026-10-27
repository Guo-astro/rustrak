/** Someone an issue can be assigned to. */
export interface Assignable {
  id: number;
  email: string;
}

/**
 * Who the reader can assign an issue to: the project's members, and always
 * the reader -- an admin sees every project without being a member of it,
 * and an issue assigned to them must still read as theirs.
 */
export function assignable(
  members: readonly { user_id: number; email: string }[],
  reader: { id: number; email: string } | null,
): Assignable[] {
  const list = members.map((m) => ({ id: m.user_id, email: m.email }));
  if (reader && !list.some((m) => m.id === reader.id)) {
    list.unshift({ id: reader.id, email: reader.email });
  }
  return list;
}
