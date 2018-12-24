import firebase from 'firebase';
import 'firebase/firestore';
import rebase from 're-base';
import env from 'env';

const app = firebase.initializeApp(env.firebase);
var firestore = app.firestore();
firestore.settings({ timestampsInSnapshots: true });

export const ReBase = rebase.createClass(firestore);
