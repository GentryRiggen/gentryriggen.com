import system from 'system-components';

const baseStyles = [
  'space',
  'width',
  'textAlign',
  'lineHeight',
  'fontWeight',
  'letterSpacing',
];

const Text = system(
  {
    is: 'p',
    fontSize: 1,
    fontWeight: 1,
    color: 'dark-gray',
  },
  ...baseStyles,
);
Text.displayName = 'Text';

const Title = system(
  {
    is: 'p',
    fontSize: [3, 3, 4],
    fontWeight: 2,
    color: 'dark-gray',
  },
  ...baseStyles,
);
Title.displayName = 'Title';

export {
  Text,
  Title,
};
