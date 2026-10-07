import type { AuthUser } from "@/lib/firebase/client";

/**
 * The admin's Firebase UID (public, not a credential). Keep in sync with
 * isAdmin() in firestore.rules, which is the real enforcement.
 */
export const ADMIN_UID = "nmt3n9sdfCX2NfzVlTdyXsWzHqm2";

export function isAdminUser(user: AuthUser | null): boolean {
  return user !== null && user.uid === ADMIN_UID;
}
