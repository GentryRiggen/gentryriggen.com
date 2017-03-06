import axios from 'axios';
import config from '../../conf';

const baseUrl = `${config.API_URL}books`;

export const GET_BOOKS_SUCCESS = 'GET_BOOKS_SUCCESS';
export const GET_BOOKS_FAILURE = 'GET_BOOKS_FAILURE';
export const getBooks = () => {
  return (dispatch) => {
    axios.get(`${baseUrl}?page=1&pageSize=9999`)
      .then(response => {
        dispatch({
          type: GET_BOOKS_SUCCESS,
          payload: response.data,
        });
      })
      .catch(() => {
        dispatch({ type: GET_BOOKS_FAILURE });
      });
  };
};

const initialState = {
  all: [],
  error: false,
};

const books = (state = initialState, action) => {
  switch(action.type) {
    case GET_BOOKS_SUCCESS:
      return {
        ...state,
        all: action.payload.books,
        error: false,
      };
    case GET_BOOKS_FAILURE:
      return {
        ...state,
        error: 'Failed to get books',
      };
    default:
      return state;
  }
};

export default books;
