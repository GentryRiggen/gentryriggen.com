const primary = '#2A72F0'
const secondary = '#E03D95'
const tertiary = '#EA9A21'
const text = '#444444'

export interface IColors {
  primary: string
  secondary: string
  tertiary: string
  error: string
  success: string
  warning: string
  info: string
  text: string
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
}

export default colors
