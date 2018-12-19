import * as React from "react";

export interface IHelloProps { compiler: string; framework: string; }

export class Hello extends React.PureComponent<IHelloProps, {}> {
  public render() {
    return (
      <h1>
        Hello from {this.props.compiler} and {this.props.framework}!
      </h1>
    );
  }
}
