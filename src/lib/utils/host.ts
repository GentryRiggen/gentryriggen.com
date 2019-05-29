import * as R from 'ramda'

export const isOnHost = (host: string | string[]) => {
  const hostname = R.pathOr('N/A', ['location', 'hostname'], window)
  const hosts = Array.isArray(host) ? host : [host]
  return R.contains(hostname, hosts)
}
