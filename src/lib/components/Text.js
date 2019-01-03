import {
  variant,
} from 'styled-system';

import createComponent from 'lib/components/defaults';

export const textStyle = variant({
  key: 'textStyles',
  prop: 'textStyle',
});
export default createComponent(
  'p',
  'Text',
  textStyle,
  { textStyle: 'text' },
);
