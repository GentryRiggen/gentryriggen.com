import React from 'react'
import { Flex, Icon, useColorMode } from '@chakra-ui/core'
import 'react-toggle/style.css'
import Toggle from 'react-toggle'

import 'lib/styles/react-toggle.css'

export default function Header() {
  const { colorMode, toggleColorMode } = useColorMode()

  return (
    <nav>
      <Flex direction="row" justify="flex-end" align="center" py={2} px={4}>
        <Toggle
          checked={colorMode === 'dark'}
          onChange={toggleColorMode}
          icons={{
            unchecked: <Icon name="sun" size="12px" color="yellow.400" />,
            checked: <Icon name="moon" size="12px" color="yellow.400" />,
          }}
        />
      </Flex>
    </nav>
  )
}
