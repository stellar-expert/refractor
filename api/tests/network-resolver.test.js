const {resolveNetwork, resolveNetworkId, resolveNetworkParams, normalizeNetworkName} = require('../business-logic/network-resolver')

describe('normalizeNetworkName', () => {
    test.each([
        ['public', 'public'],
        ['PUBLIC', 'public'],
        ['0', 'public'],
        [0, 'public'],
        ['testnet', 'testnet'],
        ['test', 'testnet'],
        ['TESTNET', 'testnet'],
        ['1', 'testnet'],
        [1, 'testnet']
    ])('normalizes %p to %p', (input, expected) => {
        expect(normalizeNetworkName(input)).toBe(expected)
    })

    test('throws for unknown network', () => {
        expect(() => normalizeNetworkName('futurenet')).toThrow()
        expect(() => normalizeNetworkName(99)).toThrow()
    })
})

describe('resolveNetwork', () => {
    test('returns config with rpc, and passphrase for public', () => {
        const result = resolveNetwork('public')
        expect(result).toHaveProperty('rpc')
        expect(result).toHaveProperty('passphrase')
        expect(result.passphrase).toBeTruthy()
    })

    test('returns config for testnet', () => {
        const result = resolveNetwork('testnet')
        expect(result).toHaveProperty('passphrase')
    })
})

describe('resolveNetworkId', () => {
    test('returns 0 for public', () => {
        expect(resolveNetworkId('public')).toBe(0)
    })

    test('returns 1 for testnet', () => {
        expect(resolveNetworkId('testnet')).toBe(1)
    })
})

describe('resolveNetworkParams', () => {
    test('returns same result as resolveNetwork', () => {
        expect(resolveNetworkParams('public')).toEqual(resolveNetwork('public'))
    })
})
