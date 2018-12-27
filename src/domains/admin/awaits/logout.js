import app from 'lib/firebase';

export const logout = () => app.auth().signOut();
