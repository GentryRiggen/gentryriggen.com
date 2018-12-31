import system from 'system-components';

const baseStyles = [
  'space',
  'width',
  'color',
  'fontSize',
  'borders',
  'borderColor',
  'borderRadius',
  'display',
  'maxWidth',
  'minWidth',
  'height',
  'maxHeight',
  'minHeight',
  'alignItems',
  'alignContent',
  'justifyContent',
  'flexWrap',
  'flexDirection',
  'flex',
  'flexBasis',
  'justifySelf',
  'alignSelf',
  'order',
  'position',
  'zIndex',
  'top',
  'right',
  'bottom',
  'left',
];
const View = system(...baseStyles);
View.displayName = 'View';
export default View;

const Flex = system(
  {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
  },
  ...baseStyles,
);
Flex.displayName = 'Flex';

export {
  Flex,
};
