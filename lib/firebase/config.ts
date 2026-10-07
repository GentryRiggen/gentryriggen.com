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
 * project; access is enforced by firestore.rules). If apiKey/projectId are
 * ever empty, the tracker and /admin do nothing.
 */
export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "AIzaSyBmBW20SkKmOdG9nHb0crrx2UxwYUG5guE",
  authDomain: "gentryriggen.firebaseapp.com",
  projectId: "gentryriggen",
  storageBucket: "gentryriggen.firebasestorage.app",
  messagingSenderId: "997603129413",
  appId: "1:997603129413:web:ba574fd8efcdf6d934cb2c",
};

export function isFirebaseConfigured(
  config: FirebaseWebConfig = firebaseConfig
): boolean {
  return Boolean(config.apiKey && config.projectId);
}
