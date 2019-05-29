// tslint:disable
declare module 'react-animation' {
  export interface IAnimateOnChangeProps {
    animationIn?: string
    animationOut?: string
    durationOut?: number
    className?: string
  }
  export class AnimateOnChange extends React.Component<
    IAnimateOnChangeProps,
    any
  > {}

  export interface IHideUntilLoadedProps {
    animationIn?: string
    imageToLoad?: string
    Spinner?: any
  }
  export class HideUntilLoaded extends React.Component<
    IHideUntilLoadedProps,
    any
  > {}
}
