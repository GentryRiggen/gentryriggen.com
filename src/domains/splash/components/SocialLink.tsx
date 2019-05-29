import React from 'react'
import View from 'lib/components/View'
import Text from 'lib/components/Text'

interface IProps {
  link: string
  icon: string
  color: string
}

export const SocialLink = (props: IProps) => {
  return (
    <View mx={[2, 3]}>
      <a href={props.link} target="_blank" rel="noopener noreferrer">
        <Text className={props.icon} fontSize={[32, 48]} color={props.color} />
      </a>
    </View>
  )
}

export default SocialLink
