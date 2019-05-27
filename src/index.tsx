import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { ThemeProvider } from 'styled-components'

import 'lib/styles/css/index.css'
import theme from 'lib/styles/theme'
import View from 'lib/components/View'

ReactDOM.render(
  <ThemeProvider theme={theme}>
    <View flexible="row-v-center">
      <View height={300} width={300} bg="primary" />
      <View height={300} width={300} bg="secondary" />
      <View height={300} width={300} bg="tertiary" />
    </View>
  </ThemeProvider>,
  document.getElementById('root'),
)
