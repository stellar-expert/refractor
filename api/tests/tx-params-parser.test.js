const {Keypair, Networks, TransactionBuilder, Account, Operation, Asset} = require('@stellar/stellar-sdk')
const {parseTxParams, sliceTx} = require('../business-logic/tx-params-parser')
const {getUnixTimestamp} = require('../business-logic/timestamp-utils')

// Build a real test transaction
function buildTestTx({minTime = '0', maxTime = '0'} = {}) {
    const kp = Keypair.random()
    const account = new Account(kp.publicKey(), '100')
    const builder = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET
    })
    if (minTime !== '0' || maxTime !== '0') {
        builder.setTimeout(0)
        builder.addOperation(Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10'
        }))
        // Manually set timebounds via preconditions
        const tx = builder.build()
        // Override timeBounds for test control
        tx._timeBounds = {minTime, maxTime}
        return tx
    }
    builder.setTimeout(30)
    builder.addOperation(Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: '10'
    }))
    return builder.build()
}

describe('parseTxParams', () => {
    test('returns TxModel with correct network and empty signatures', () => {
        const tx = buildTestTx()
        const result = parseTxParams(tx, {network: 'testnet'})
        expect(result.network).toBe(1)
        expect(result.xdr).toBeTruthy()
        expect(result.signatures).toEqual([])
    })

    test('stores valid callbackUrl', () => {
        const tx = buildTestTx()
        const result = parseTxParams(tx, {network: 'testnet', callbackUrl: 'https://example.com/callback'})
        expect(result.callbackUrl).toBe('https://example.com/callback')
    })

    test('rejects invalid callbackUrl', () => {
        const tx = buildTestTx()
        expect(() => parseTxParams(tx, {network: 'testnet', callbackUrl: 'not-a-url'}))
            .toThrow('Invalid URL')
    })

    test('stores valid desiredSigners', () => {
        const tx = buildTestTx()
        const keys = [Keypair.random().publicKey(), Keypair.random().publicKey()]
        const result = parseTxParams(tx, {network: 'testnet', desiredSigners: keys})
        expect(result.desiredSigners).toEqual(keys)
    })

    test('rejects non-array desiredSigners', () => {
        const tx = buildTestTx()
        expect(() => parseTxParams(tx, {network: 'testnet', desiredSigners: 'GABC'}))
            .toThrow('requestedSigners')
    })

    test('rejects invalid key in desiredSigners', () => {
        const tx = buildTestTx()
        expect(() => parseTxParams(tx, {network: 'testnet', desiredSigners: ['not-a-key']}))
            .toThrow('not a valid Stellar public key')
    })

    test('rejects expires in the past', () => {
        const tx = buildTestTx()
        const pastTime = getUnixTimestamp() - 1000
        expect(() => parseTxParams(tx, {network: 'testnet', expires: pastTime}))
            .toThrow('already passed')
    })

    test('rejects expires exceeding max int', () => {
        const tx = buildTestTx()
        expect(() => parseTxParams(tx, {network: 'testnet', expires: 2147483648}))
            .toThrow('not a valid UNIX date')
    })

    test('sets submit flag when true', () => {
        const tx = buildTestTx()
        const result = parseTxParams(tx, {network: 'testnet', submit: true})
        expect(result.submit).toBe(true)
    })

    test('does not set submit when falsy', () => {
        const tx = buildTestTx()
        const result = parseTxParams(tx, {network: 'testnet'})
        expect(result.submit).toBeUndefined()
    })
})

describe('sliceTx', () => {
    test('strips signatures from transaction', () => {
        const tx = buildTestTx()
        const kp = Keypair.random()
        tx.sign(kp)
        expect(tx.signatures.length).toBe(1)

        const {tx: sliced, signatures} = sliceTx(tx)
        expect(signatures).toHaveLength(1)
        expect(sliced._signatures).toEqual([])
    })
})
