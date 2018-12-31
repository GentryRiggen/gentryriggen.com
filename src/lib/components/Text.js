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
    lineHeight: 'title',
    color: 'text',
  },
  ...baseStyles,
);
Title.displayName = 'Title';

const Jumbo = system(
  {
    is: 'p',
    fontSize: 'jumbo',
    fontWeight: 'jumbo',
    lineHeight: 'jumbo',
    color: 'text',
  },
  ...baseStyles,
);
Jumbo.displayName = 'Jumbo';

const Subtitle = system(
  {
    is: 'p',
    fontSize: 'subtitle',
    fontWeight: 'subtitle',
    lineHeight: 'subtitle',
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
    lineHeight: 'caption',
    color: 'text',
  },
  ...baseStyles,
);
Caption.displayName = 'Caption';

export {
  Caption,
  Jumbo,
  Subtitle,
  Text,
  Title,
};
