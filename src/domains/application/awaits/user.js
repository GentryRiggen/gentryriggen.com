import app from 'lib/firebase';
import store from 'lib/store/index';
import { actions } from 'domains/application/ducks/application';

export const watchUserAuthentication = async () => {
  app.auth().onAuthStateChanged((user) => {
    console.log({ user });
    if (user) {
      store.dispatch(actions.authenticated.set(true));
    } else {
      store.dispatch(actions.authenticated.set(false));
    }
  });
}
