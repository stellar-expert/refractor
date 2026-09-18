const {Keypair, Networks, TransactionBuilder, Account, Operation, Asset} = require('@stellar/stellar-sdk')
const {toBuffer, parseDecoratedSignature} = require('../business-logic/xdr-utils')

function buildSignedTx(kp) {
    const tx = new TransactionBuilder(new Account(kp.publicKey(), '100'), {fee: '100', networkPassphrase: Networks.TESTNET})
        .addOperation(Operation.payment({destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '10'}))
        .setTimeout(30)
        .build()
    tx.sign(kp)
    return tx
}

describe('toBuffer', () => {
    test('wraps Uint8Array into Buffer preserving bytes', () => {
        const res = toBuffer(new Uint8Array([1, 2, 3]))
        expect(Buffer.isBuffer(res)).toBe(true)
        expect(res.toString('hex')).toBe('010203')
    })

    test('respects byte offset of a typed array view', () => {
        const backing = new Uint8Array([9, 9, 1, 2, 9])
        const res = toBuffer(backing.subarray(2, 4))
        expect(res.toString('hex')).toBe('0102')
    })

    test('returns Buffer as is', () => {
        const buf = Buffer.from('abc')
        expect(toBuffer(buf)).toBe(buf)
    })
})

describe('parseDecoratedSignature', () => {
    test('extracts hint and signature as Buffers', () => {
        const kp = Keypair.random()
        const tx = buildSignedTx(kp)
        const {hint, signature} = parseDecoratedSignature(tx.signatures[0])
        expect(Buffer.isBuffer(hint)).toBe(true)
        expect(Buffer.isBuffer(signature)).toBe(true)
        expect(hint.length).toBe(4)
        expect(signature.length).toBe(64)
        expect(hint.equals(toBuffer(kp.signatureHint()))).toBe(true)
        expect(kp.verify(tx.hash(), signature)).toBe(true)
    })
})
