const primary = '#2A72F0'
const secondary = '#E03D95'
const tertiary = '#8C03DB'
const text = '#4f4756'
const textLight = '#757476'

export interface IColors {
  primary: string
  secondary: string
  tertiary: string
  error: string
  success: string
  warning: string
  info: string
  text: string
  textLight: string
}

export type ColorOptions =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'

const colors: IColors = {
  primary,
  secondary,
  tertiary,
  error: '#ED1C24',
  success: '#00a651',
  warning: '#FFCA29',
  info: tertiary,
  text,
  textLight,
}

export default colors
