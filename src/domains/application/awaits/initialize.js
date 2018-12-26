import { watchUserAuthentication } from 'domains/admin/awaits/watchUserAuthentication';

export default async () => {
  watchUserAuthentication();
}
