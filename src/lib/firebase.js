import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import rebase from 're-base';

const app = firebase.initializeApp({
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
});
export const firestore = app.firestore();
firestore.settings({ timestampsInSnapshots: true });

export const getCollection = async (path) => {
  const snapshot = await firestore.collection(path).get();
  const collection = [];
  snapshot.forEach(doc => collection.push({ id: doc.id, ...doc.data() }));
  return collection;
};

export const ReBase = rebase.createClass(firestore);

export default app;
