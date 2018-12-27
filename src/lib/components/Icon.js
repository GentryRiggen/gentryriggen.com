import system from 'system-components';

const baseStyles = [
  'space',
  'width',
  'textAlign',
  'lineHeight',
  'fontWeight',
  'letterSpacing',
];

const Icon = system(
  {
    is: 'i',
    fontSize: 'text',
    color: 'text',
  },
  ...baseStyles,
);
Icon.displayName = 'Icon';

export default Icon;
