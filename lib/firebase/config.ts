export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

/**
 * Firebase web config. These values are public by design (they identify the
 * project; access is enforced by firestore.rules). While apiKey/projectId are
 * empty, the tracker and /admin do nothing.
 */
export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "",
  authDomain: "gentryriggen.firebaseapp.com",
  projectId: "gentryriggen",
  appId: "",
};

export function isFirebaseConfigured(
  config: FirebaseWebConfig = firebaseConfig
): boolean {
  return Boolean(config.apiKey && config.projectId);
}
