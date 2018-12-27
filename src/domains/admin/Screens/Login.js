import React, { PureComponent } from 'react';

import {
  Button,
  Input,
  Text,
  Title,
  View,
} from 'lib/components';

import { login } from 'domains/admin/awaits/login';

export class Login extends PureComponent {
  state = {
    email: '',
    password: '',
    user: false,
  }

  onChangeEmail = ({ target: { value } }) => this.setState({ email: value })

  onChangePassword = ({ target: { value } }) => this.setState({ password: value })

  onSubmit = async () => {
    const user = await login(this.state.email, this.state.password);
    if (user) {
      window.location.href = '/admin';
    }
  }

  render() {
    return (
      <View
        display="flex"
        flex="1 0 auto"
        flexDirection="column"
        alignItems="center"
        pt="md"
      >
        <Title>Log In</Title>
        <View
          display="flex"
          flex="1 0 auto"
          flexDirection="column"
          alignItems="center"
          pt="md"
        >
          <Input
            width={200}
            placeholder="Email"
            type="email"
            onChange={this.onChangeEmail}
            required
            autoFocus
          />
          <Input
            width={200}
            placeholder="Password"
            type="password"
            onChange={this.onChangePassword}
            required
          />
          <Button onClick={this.onSubmit}>
            <Text>Submit</Text>
          </Button>
        </View>
      </View>
    );
  }
}

export default Login;
