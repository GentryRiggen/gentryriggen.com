export const WINDOW_SIZE_CHANGE = 'WINDOW_SIZE_CHANGE';
export const windowSizeChange = (width) => {
  return (dispatch) => {
    dispatch({
      type: WINDOW_SIZE_CHANGE,
      payload: width,
    });
  };
};

const initialState = {
  isSmall: false,
};

const browser = (state = initialState, action) => {
  switch (action.type) {
    case WINDOW_SIZE_CHANGE:
      return {
        ...state,
        isSmall: action.payload < 600,
      };
    default:
      return state;
  }
};

export default browser;
