import { createReducers, Definitions } from 'redux-enterprise';

const { Field } = Definitions;

const ducks = createReducers({
  application: {
    loggedInUser: Field,
  },
});

export const { application: selectors } = ducks.selectors;
export const { reducers } = ducks;
export const { application: actions } = ducks.actions;
