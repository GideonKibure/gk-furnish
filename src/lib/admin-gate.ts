/** The same refusal the admin middleware uses when the session is not an owner. */
export function assertAdminMember(isMember: boolean) {
  if (!isMember) throw new Error("Forbidden: admin access required");
}
