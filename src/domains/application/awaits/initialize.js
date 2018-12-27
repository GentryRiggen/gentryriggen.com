import { watchUserAuthentication } from 'domains/admin/awaits/watchUserAuthentication';
import { getFeatures } from 'domains/features/awaits/getFeatures';

export default async () => {
  watchUserAuthentication();
  await getFeatures();
}
