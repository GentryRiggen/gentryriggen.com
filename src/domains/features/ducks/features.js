export const SET_FEATURES = '@@features/SET_FEATURES';
export const setFeatures = payload => ({
  type: SET_FEATURES,
  payload,
})

const initialState = {};

export default (state = initialState, action) => {
  switch (action.type) {
    case SET_FEATURES:
      return action.payload;
    default:
      return state;
  }
}
