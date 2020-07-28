import { theme } from '@chakra-ui/core'

const customTheme = {
  ...theme,
  colors: {
    ...theme.colors,
    primary: {
      900: '#001520',
      800: '#003951',
      700: '#005d82',
      600: '#0083b4',
      500: '#00a8e6',
      400: '#1ac1ff',
      300: '#48cfff',
      200: '#7adeff',
      100: '#abebff',
      50: '#d8fbff',
    },
    secondary: {
      900: '#1f0500',
      800: '#7d2802',
      700: '#7d2802',
      600: '#ae3905',
      500: '#de4b08',
      400: '#f86421',
      300: '#fa8651',
      200: '#fda882',
      100: '#ffcab2',
      50: '#ffecde',
    },
  },
  breakpoints: ['30em', '48em', '62em', '80em', '100em'],
  fonts: {
    heading: '"Avenir Next", sans-serif',
    body: 'system-ui, sans-serif',
    mono: 'Menlo, monospace',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '4rem',
  },
}

export default customTheme
