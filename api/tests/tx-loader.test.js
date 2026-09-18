jest.mock('../storage/storage-layer')
jest.mock('../business-logic/tx-status-refresher')

const {Keypair, Networks, TransactionBuilder, Account, Operation, Asset} = require('@stellar/stellar-sdk')
const storageLayer = require('../storage/storage-layer')
const InMemoryDataProvider = require('../storage/inmemory-data-provider')
const {rehydrateTx, loadRehydrateTx} = require('../business-logic/tx-loader')
const {toBuffer} = require('../business-logic/xdr-utils')
const {refreshTxStatus} = require('../business-logic/tx-status-refresher')

const kp = Keypair.random()

function buildTx() {
    return new TransactionBuilder(new Account(kp.publicKey(), '100'), {fee: '100', networkPassphrase: Networks.TESTNET})
        .addOperation(Operation.payment({destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '10'}))
        .setTimeout(300)
        .build()
}

function signatureOf(tx) {
    const signed = TransactionBuilder.fromXDR(tx.toXDR(), Networks.TESTNET)
    signed.sign(kp)
    return toBuffer(signed.signatures[0].signature.toBytes())
}

beforeEach(async () => {
    const provider = new InMemoryDataProvider()
    await provider.init()
    storageLayer.dataProvider = provider
    refreshTxStatus.mockImplementation(async txInfo => txInfo)
})

describe('rehydrateTx', () => {
    test('normalizes network name and attaches raw signatures', () => {
        const tx = buildTx()
        const res = rehydrateTx({hash: 'h', network: 1, xdr: tx.toXDR(), signatures: [{key: kp.publicKey(), signature: signatureOf(tx)}], status: 'ready'})
        expect(res.network).toBe('testnet')
        expect(res.hash).toBe('h')
        expect(res.status).toBe('ready')
        const rehydrated = TransactionBuilder.fromXDR(res.xdr, Networks.TESTNET)
        expect(rehydrated.signatures).toHaveLength(1)
        expect(kp.verify(rehydrated.hash(), rehydrated.signatures[0].signature.toBytes())).toBe(true)
    })

    test('accepts signatures stored as Uint8Array and base64 strings', () => {
        const tx = buildTx()
        const signature = signatureOf(tx)
        const fromBytes = rehydrateTx({network: 1, xdr: tx.toXDR(), signatures: [{key: kp.publicKey(), signature: new Uint8Array(signature)}]})
        const fromString = rehydrateTx({network: 1, xdr: tx.toXDR(), signatures: [{key: kp.publicKey(), signature: signature.toString('base64')}]})
        expect(fromBytes.xdr).toBe(fromString.xdr)
        expect(TransactionBuilder.fromXDR(fromBytes.xdr, Networks.TESTNET).signatures).toHaveLength(1)
    })

    test('returns unsigned xdr when signatures are missing', () => {
        const tx = buildTx()
        const res = rehydrateTx({network: 'public', xdr: tx.toXDR()})
        expect(res.network).toBe('public')
        expect(res.xdr).toBe(tx.toXDR())
    })
})

describe('loadRehydrateTx', () => {
    test('loads and rehydrates transaction from storage', async () => {
        const tx = buildTx()
        await storageLayer.dataProvider.saveTransaction({hash: 'stored', network: 1, xdr: tx.toXDR(), signatures: [{key: kp.publicKey(), signature: signatureOf(tx)}]})
        const res = await loadRehydrateTx('stored')
        expect(res.hash).toBe('stored')
        expect(refreshTxStatus).toHaveBeenCalledWith(expect.objectContaining({hash: 'stored'}))
        expect(TransactionBuilder.fromXDR(res.xdr, Networks.TESTNET).signatures).toHaveLength(1)
    })

    test('rejects with 404 error for unknown hash', async () => {
        await expect(loadRehydrateTx('missing')).rejects.toMatchObject({status: 404, message: 'Transaction missing not found.'})
        expect(refreshTxStatus).not.toHaveBeenCalled()
    })

    test('returns refreshed status', async () => {
        const tx = buildTx()
        await storageLayer.dataProvider.saveTransaction({hash: 'failed', network: 1, xdr: tx.toXDR(), signatures: [], status: 'failed'})
        refreshTxStatus.mockImplementation(async txInfo => Object.assign(txInfo, {status: 'processed', submitted: 1700000000}))
        const res = await loadRehydrateTx('failed')
        expect(res.status).toBe('processed')
        expect(res.submitted).toBe(1700000000)
    })
})
