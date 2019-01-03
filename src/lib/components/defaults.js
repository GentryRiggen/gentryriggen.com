import styled from 'styled-components';

import {
  variant,
  space,
  width,
  color,
  fontSize,
  borders,
  borderColor,
  borderRadius,
  display,
  maxWidth,
  minWidth,
  height,
  maxHeight,
  minHeight,
  alignItems,
  alignContent,
  justifyContent,
  flexWrap,
  flexDirection,
  flex,
  flexBasis,
  justifySelf,
  alignSelf,
  order,
  position,
  zIndex,
  top,
  right,
  bottom,
  left,
  textAlign,
  lineHeight,
  fontWeight,
  letterSpacing,
} from 'styled-system';

export const flexStyle = variant({
  key: 'flexStyles',
  prop: 'flexStyle',
});

export default (htmlTag, displayName, styles = '', defaultProps = {}) => {
  const Component = styled[htmlTag]`
    ${space}
    ${width}
    ${color}
    ${fontSize}
    ${borders}
    ${borderColor}
    ${borderRadius}
    ${display}
    ${maxWidth}
    ${minWidth}
    ${height}
    ${maxHeight}
    ${minHeight}
    ${alignItems}
    ${alignContent}
    ${justifyContent}
    ${flexWrap}
    ${flexDirection}
    ${flex}
    ${flexBasis}
    ${justifySelf}
    ${alignSelf}
    ${order}
    ${position}
    ${zIndex}
    ${top}
    ${right}
    ${bottom}
    ${left}
    ${textAlign}
    ${lineHeight}
    ${fontWeight}
    ${letterSpacing}
    ${flexStyle}
    ${styles}
  `;
  Component.displayName = displayName;
  Component.defaultProps = defaultProps;
  return Component;
};
