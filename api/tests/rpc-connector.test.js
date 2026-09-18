const {Keypair, xdr} = require('@stellar/stellar-sdk')
const {loadAccountsInfo, formatErrorResult} = require('../business-logic/rpc-connector')

function buildAccountEntryXdr({accountId, seqNum, thresholds, signers = []}) {
    const entry = new xdr.AccountEntry({
        accountId,
        balance: 100000000n,
        seqNum,
        numSubEntries: signers.length,
        inflationDest: null,
        flags: 0,
        homeDomain: '',
        thresholds: new Uint8Array(thresholds),
        signers: signers.map(({key, weight}) => new xdr.Signer({key, weight})),
        ext: xdr.AccountEntryExt.v0()
    })
    return xdr.LedgerEntryData.account(entry).toXdr('base64')
}

describe('loadAccountsInfo', () => {
    const originalFetch = global.fetch
    let requests

    beforeEach(() => {
        requests = []
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    function mockRpc(entries) {
        global.fetch = jest.fn(async (url, init) => {
            requests.push(JSON.parse(init.body))
            return {json: async () => ({jsonrpc: '2.0', id: 1, result: {entries, latestLedger: 100}})}
        })
    }

    test('parses account entries returned by getLedgerEntries', async () => {
        const account = Keypair.random()
        const signer = Keypair.random()
        const hashXSigner = xdr.SignerKey.signerKeyTypeHashX(new Uint8Array(32).fill(7))
        mockRpc([{
            key: 'ignored',
            xdr: buildAccountEntryXdr({
                accountId: account.xdrAccountId(),
                seqNum: 12345678901234567n,
                thresholds: [1, 0, 2, 3],
                signers: [
                    {key: xdr.SignerKey.signerKeyTypeEd25519(signer.rawPublicKey()), weight: 5},
                    {key: hashXSigner, weight: 1}
                ]
            })
        }])

        const res = await loadAccountsInfo('testnet', [account.publicKey()])

        expect(requests).toHaveLength(1)
        expect(requests[0].method).toBe('getLedgerEntries')
        expect(requests[0].params.keys).toHaveLength(1)
        expect(res).toEqual([{
            id: account.publicKey(),
            account_id: account.publicKey(),
            sequence: '12345678901234567',
            thresholds: {low_threshold: 0, med_threshold: 2, high_threshold: 3},
            signers: [
                {type: 'ed25519_public_key', key: account.publicKey(), weight: 1},
                {type: 'ed25519_public_key', key: signer.publicKey(), weight: 5}
            ]
        }])
    })

    test('omits master key when master weight is zero', async () => {
        const account = Keypair.random()
        const signer = Keypair.random()
        mockRpc([{
            xdr: buildAccountEntryXdr({
                accountId: account.xdrAccountId(),
                seqNum: 1n,
                thresholds: [0, 1, 1, 1],
                signers: [{key: xdr.SignerKey.signerKeyTypeEd25519(signer.rawPublicKey()), weight: 1}]
            })
        }])

        const [res] = await loadAccountsInfo('testnet', [account.publicKey()])
        expect(res.signers).toEqual([{type: 'ed25519_public_key', key: signer.publicKey(), weight: 1}])
    })

    test('splits requests into batches of 200 accounts', async () => {
        const accounts = Array.from({length: 250}, () => Keypair.random())
        global.fetch = jest.fn(async (url, init) => {
            const body = JSON.parse(init.body)
            requests.push(body)
            const entries = body.params.keys.map(key => {
                const ledgerKey = xdr.LedgerKey.fromXdr(key, 'base64')
                return {xdr: buildAccountEntryXdr({accountId: ledgerKey.account.accountId, seqNum: 1n, thresholds: [1, 0, 0, 0]})}
            })
            return {json: async () => ({result: {entries}})}
        })

        const res = await loadAccountsInfo('testnet', accounts.map(kp => kp.publicKey()))
        expect(requests.map(r => r.params.keys.length)).toEqual([200, 50])
        expect(res.map(a => a.id)).toEqual(accounts.map(kp => kp.publicKey()))
    })

    test('throws on RPC error response', async () => {
        global.fetch = jest.fn(async () => ({json: async () => ({error: {message: 'boom', data: 'details'}})}))
        await expect(loadAccountsInfo('testnet', [Keypair.random().publicKey()])).rejects.toThrow('RPC error: boom')
    })
})

describe('formatErrorResult', () => {
    test('formats parsed TransactionResult', () => {
        const result = new xdr.TransactionResult({feeCharged: 100n, result: xdr.TransactionResultResult.txBadAuth(), ext: xdr.TransactionResultExt.v0()})
        expect(formatErrorResult(result)).toBe('Tx error: txBadAuth')
    })

    test('formats base64-encoded TransactionResult', () => {
        const result = new xdr.TransactionResult({feeCharged: 100n, result: xdr.TransactionResultResult.txBadSeq(), ext: xdr.TransactionResultExt.v0()})
        expect(formatErrorResult(result.toXdr('base64'))).toBe('Tx error: txBadSeq')
    })
})
