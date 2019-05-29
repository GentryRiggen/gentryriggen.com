const keyframes = {
  show: `@keyframes show {
    to {
      opacity: 1;
      transform: none;
    }
  }`,
}

export const animations = {
  show: `
    animation: show 500ms ease-out forwards;
    ${keyframes.show}
  `,
}
