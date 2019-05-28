const primary = '#2A72F0'
const secondary = '#E03D95'
const tertiary = '#EA9A21'
const text = '#4f4756'
const textLight = '#868587'

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
