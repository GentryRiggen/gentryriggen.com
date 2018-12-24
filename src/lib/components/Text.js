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

const Subtitle = system(
  {
    is: 'p',
    fontSize: 'subtitle',
    fontWeight: 'subtitle',
    color: 'text',
  },
  ...baseStyles,
);
Subtitle.displayName = 'Subtitle';

const Caption = system(
  {
    is: 'p',
    fontSize: 'caption',
    fontWeight: 'caption',
    color: 'text',
  },
  ...baseStyles,
);
Caption.displayName = 'Caption';

export {
  Caption,
  Subtitle,
  Text,
  Title,
};
