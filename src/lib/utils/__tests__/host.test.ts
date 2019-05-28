import { isOnHost } from 'lib/utils/host'

describe('#isOnHost', () => {
  describe('when not on specified host', () => {
    it('should return false', () => {
      expect(isOnHost('yolo')).toBe(false)
    })
  })
  describe('when on specified host', () => {
    it('should return true', () => {
      expect(isOnHost('localhost')).toBe(true)
    })
  })
})
