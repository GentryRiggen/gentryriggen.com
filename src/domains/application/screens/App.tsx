import * as React from "react";

export interface IAppProps {}

export class App extends React.PureComponent<IAppProps, {}> {
  public render() {
    return (
      <h1>Hello, World!</h1>
    );
  }
}

export default App;
