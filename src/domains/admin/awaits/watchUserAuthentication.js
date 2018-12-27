import app from 'lib/firebase';
import store from 'lib/store/index';
import { actions } from 'domains/application/ducks/application';

export const watchUserAuthentication = () => {
  app.auth().onAuthStateChanged((user) => {
    console.log({ user });
    if (user) {
      store.dispatch(actions.loggedInUser.set(true));
    } else {
      store.dispatch(actions.loggedInUser.set(false));
    }
  });
}
