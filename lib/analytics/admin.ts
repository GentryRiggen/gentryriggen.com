import type { AuthUser } from "@/lib/firebase/client";

/** Keep in sync with isAdmin() in firestore.rules (the real enforcement). */
export const ADMIN_EMAIL = "gentry.riggen@gmail.com";

export function isAdminUser(user: AuthUser | null): boolean {
  return (
    user !== null &&
    user.emailVerified &&
    user.email?.toLowerCase() === ADMIN_EMAIL
  );
}
