import { createReducers, Definitions } from 'redux-enterprise';

const { Flag } = Definitions;

const ducks = createReducers({
  application: {
    authenticated: Flag,
  },
});

export const { application: selectors } = ducks.selectors;
export const { reducers } = ducks;
export const { application: actions } = ducks.actions;
