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
    fontSize: 'text',
    fontWeight: 'text',
    color: 'text',
    lineHeight: 'text',
  },
  ...baseStyles,
);
Text.displayName = 'Text';

const Title = system(
  {
    is: 'p',
    fontSize: 'title',
    fontWeight: 'title',
    color: 'text',
  },
  ...baseStyles,
);
Title.displayName = 'Title';

export {
  Text,
  Title,
};
