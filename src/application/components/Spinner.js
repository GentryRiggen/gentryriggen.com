import React from 'react';
import theme from '../common/theme';
import './Spinner.css';

const Spinner = () => (
  <svg
    className="spinner"
    width={theme.dimensions.spinnerSize}
    height={theme.dimensions.spinnerSize}
    viewBox="0 0 66 66"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      className="path"
      fill="none"
      strokeWidth="6"
      strokeLinecap="round"
      cx="33"
      cy="33"
      r="30"
    >
    </circle>
  </svg>
);

export default Spinner;
