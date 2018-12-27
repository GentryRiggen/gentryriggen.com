import React, { PureComponent } from 'react';

import {
  Button,
  Title,
  View,
} from 'lib/components';
import { logout } from 'domains/admin/awaits/logout';

export class Admin extends PureComponent {
  render() {
    console.log('ADMIN');
    return (
      <View
        display="flex"
        flexDirection="column"
        p="md"
      >
        <View
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          p="md"
        >
          <Title>Admin</Title>
          <Button onClick={logout}>Log out</Button>
        </View>


      </View>
    );
  }
}

export default Admin;
