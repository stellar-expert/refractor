const {getUnixTimestamp} = require('../business-logic/timestamp-utils')

test('returns current UNIX timestamp in seconds', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    const result = getUnixTimestamp()
    expect(result).toBe(Math.floor(new Date('2025-01-15T12:00:00Z').getTime() / 1000))
    jest.useRealTimers()
})

test('returns timestamp for a specific Date', () => {
    const date = new Date('2024-06-01T00:00:00Z')
    expect(getUnixTimestamp(date)).toBe(Math.floor(date.getTime() / 1000))
})

test('returns 0 for epoch Date', () => {
    expect(getUnixTimestamp(new Date(0))).toBe(0)
})

test('returns undefined for non-Date values', () => {
    expect(getUnixTimestamp('2024-01-01')).toBeUndefined()
    expect(getUnixTimestamp(12345)).toBeUndefined()
    expect(getUnixTimestamp(null)).toBeUndefined()
})
