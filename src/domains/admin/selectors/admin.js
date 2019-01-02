import { createSelector } from 'reselect';
import { selectors } from 'domains/application/ducks/application';

export const isLoggedInSelector = createSelector(
  selectors.loggedInUser.get,
  loggedInUser => !!loggedInUser,
);
