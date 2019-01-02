
import * as selectors from '../admin';
import store from 'lib/store/index';
import { actions } from 'domains/application/ducks/application';

describe('#isLoggedInSelector', () => {
  describe('when the user is logged in', () => {
    it('should return true', () => {
      store.dispatch(actions.loggedInUser.set({ id: 1 }));
      const state = store.getState();
      expect(selectors.isLoggedInSelector(state)).toBe(true);
    });
  });
  describe('when the user is not logged in', () => {
    it('should return false', () => {
      store.dispatch(actions.loggedInUser.set(null));
      const state = store.getState();
      expect(selectors.isLoggedInSelector(state)).toBe(false);
    });
  });
});
