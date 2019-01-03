import React, { PureComponent } from 'react';

import {
  Button,
  Text,
  View,
} from 'lib/components';
import { logout } from 'domains/admin/awaits/logout';

export class Admin extends PureComponent {
  render() {
    return (
      <View
        flexStyle="vertical"
        p="md"
      >
        <View
          flexStyle="horizontal"
          justifyContent="space-between"
          p="md"
        >
          <Text textStyle="title">Admin</Text>
          <Button onClick={logout}>Log out</Button>
        </View>
      </View>
    );
  }
}

export default Admin;
