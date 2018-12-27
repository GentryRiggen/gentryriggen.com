import React, { PureComponent } from 'react';

import {
  Button,
  Title,
  Flex,
} from 'lib/components';
import { logout } from 'domains/admin/awaits/logout';

export class Admin extends PureComponent {
  render() {
    return (
      <Flex
        flexDirection="column"
        p="md"
      >
        <Flex
          flexDirection="row"
          justifyContent="space-between"
          p="md"
        >
          <Title>Admin</Title>
          <Button onClick={logout}>Log out</Button>
        </Flex>
      </Flex>
    );
  }
}

export default Admin;
