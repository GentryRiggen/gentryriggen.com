import React from 'react'
import { Box, Text, Flex } from '@chakra-ui/core'
import { FaGithub, FaLinkedinIn, FaStackOverflow } from 'react-icons/fa'

interface ILinkProps {
  icon: any
  href: string
}
function Link(props: ILinkProps) {
  return (
    <Box mr={[2, 4]}>
      <a href={props.href} target="_blank" rel="noopener noreferrer">
        {props.icon}
      </a>
    </Box>
  )
}

export default function About() {
  return (
    <Box my={[4, 8]}>
      <Text fontSize={['2xl', '2xl', '3xl']}>Hi 👋, I'm</Text>
      <Text
        fontSize={['4xl', '5xl', '6xl']}
        fontWeight={700}
        color="primary.500"
      >
        Gentry
      </Text>

      <Text mt={8} fontSize={['lg', 'xl']}>
        I am a web and mobile developer. I like building products for my clients
        with React, React-Native, Firebase, SwiftUI, Node.js, PHP, and MySQL.
      </Text>

      <Box mt={16}>
        <Text mt={8} fontSize={['lg', 'xl']}>
          Get in touch / See my work
        </Text>
        <Flex direction="row" align="center" mt={2}>
          <Link
            icon={<FaGithub size="2rem" />}
            href="https://github.com/gentryriggen"
          />
          <Link
            icon={<FaLinkedinIn size="2rem" />}
            href="https://linkedin.com/in/gentryriggen"
          />
          <Link
            icon={<FaStackOverflow size="2rem" />}
            href="https://stackoverflow.com/users/1767285/gentryriggen"
          />
        </Flex>
      </Box>
    </Box>
  )
}
