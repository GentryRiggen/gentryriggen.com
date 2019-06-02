const keyframes = {
  fadeIn: `@keyframes fadeIn {
    from {
      opacity: 0;
      visibility: hidden;
    }
    to {
      opacity: 1;
      visibility: visible;
    }
  }`,
  fadeOut: `@keyframes fadeOut {
    from {
      opacity: 1;
      visibility: visible;
    }
    to {
      opacity: 0;
      visibility: hidden;
    }
  }`,
  fadeInUp: `@keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10em);
      visibility: hidden;
    }
    to {
      opacity: 1;
      transform: none;
      visibility: visible;
    }
  }`,
  fadeInDown: `@keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-10em);
      visibility: hidden;
    }
    to {
      opacity: 1;
      transform: none;
      visibility: visible;
    }
  }`,
  popIn: `@keyframes popIn {
    0% {
      opacity: 0;
      transform: scale(0);
    }
    1% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }`,
  popOut: `@keyframes popOut {
    0% {
      opacity: 1;
      transform: none;
    }
    99% {
      opacity: 0;
    }
    100% {
      opacity: 0;
      transform: scale(0);
    }
  }`,
  slideIn: `@keyframes slideIn {
    0% {
      opacity: 0;
      transform: translateY(100%);
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }`,
  slideOut: `@keyframes slideOut {
    0% {
      opacity: 1;
      transform: translateY(0%);
    }
    100% {
      opacity: 0;
      transform: translateY(-100%);
    }
  }`,
}

export const easings = {
  linear: 'linear',
  easeInSine: 'cubic-bezier(0.47, 0, 0.745, 0.715)',
  easeOutSine: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
  easeInOutSine: 'cubic-bezier(0.445, 0.05, 0.55, 0.95)',
  easeInQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  easeOutQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  easeInOutQuad: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
  easeInCubic: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  easeInQuart: 'cubic-bezier(0.895, 0.03, 0.685, 0.22)',
  easeOutQuart: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
  easeInOutQuart: 'cubic-bezier(0.77, 0, 0.175, 1)',
  easeInQuint: 'cubic-bezier(0.755, 0.05, 0.855, 0.06)',
  easeOutQuint: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeInOutQuint: 'cubic-bezier(0.86, 0, 0.07, 1)',
  easeInExpo: 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
  easeOutExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
  easeInOutExpo: 'cubic-bezier(1, 0, 0, 1)',
  easeInBack: 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
  easeOutBack: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  easeInOutBack: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}

export const animations = {
  fadeIn: `
    opacity: 0;
    animation: fadeIn 500ms ease-out forwards;
    ${keyframes.fadeIn}
  `,
  fadeOut: `
    animation: fadeOut 400ms ease-out forwards;
    ${keyframes.fadeOut}
  `,
  fadeInUp: `
    opacity: 0;
    animation: fadeInUp 500ms ${easings.easeInOutBack} forwards;
    ${keyframes.fadeInUp}
  `,
  fadeInDown: `
    opacity: 0;
    animation: fadeInDown 500ms ${easings.easeInOutBack} forwards;
    ${keyframes.fadeInDown}
  `,
  popIn: `
    opacity: 0;
    animation: popIn 500ms ${easings.easeOutExpo} forwards;
    ${keyframes.popIn}
  `,
  popOut: `
    opacity: 1;
    animation: popOut 400ms ${easings.easeOutBack} forwards;
    ${keyframes.popOut}
  `,
  bounceIn: `
    animation: popIn 300ms ${easings.easeOutBack} forwards;
    ${keyframes.popIn}
  `,
  bounceOut: `
    animation: popOut 300ms ${easings.easeInBack} forwards;
    ${keyframes.popOut}
  `,
  slideIn: `
    animation: slideIn 500ms ${easings.easeInOutBack} forwards;
    ${keyframes.slideIn}
  `,
  slideOut: `
    animation: slideOut 350ms ${easings.easeOutBack} forwards;
    ${keyframes.slideOut}
  `,
}

// export const animations = {
//   bounceIn: `pop-in 300ms ${easings.easeOutBack} forwards`,
//   bounceOut: `pop-out 300ms ${easings.easeInBack} forwards`,
// }
