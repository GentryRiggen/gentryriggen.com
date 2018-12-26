import app from 'lib/firebase';

export const login = async (email, password) => {
  try {
    return await app.auth().signInAndRetrieveDataWithEmailAndPassword(email, password);
  } catch (e) {
    console.error(e);
    return false;
  }
}
