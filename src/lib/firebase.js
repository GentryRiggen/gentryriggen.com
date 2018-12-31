import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import rebase from 're-base';
import env from 'env';

const app = firebase.initializeApp(env.firebase);
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
