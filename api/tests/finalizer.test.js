jest.mock('../business-logic/tx-loader')
jest.mock('../business-logic/rpc-connector')
jest.mock('../business-logic/finalization/callback-handler')
jest.mock('../business-logic/timestamp-utils')

const storageLayer = require('../storage/storage-layer')
const InMemoryDataProvider = require('../storage/inmemory-data-provider')
const {rehydrateTx} = require('../business-logic/tx-loader')
const {submitTransaction} = require('../business-logic/rpc-connector')
const {processCallback} = require('../business-logic/finalization/callback-handler')
const {getUnixTimestamp} = require('../business-logic/timestamp-utils')
const finalizer = require('../business-logic/finalization/finalizer')

beforeEach(async () => {
    jest.useFakeTimers()
    const provider = new InMemoryDataProvider()
    await provider.init()
    storageLayer.dataProvider = provider

    getUnixTimestamp.mockReturnValue(1000)
    rehydrateTx.mockImplementation(txInfo => ({...txInfo, rehydrated: true}))
    submitTransaction.mockResolvedValue(true)
    processCallback.mockResolvedValue()
})

afterEach(() => {
    finalizer.stop()
    jest.useRealTimers()
})

function makeTx(overrides = {}) {
    return {
        hash: 'txhash1',
        status: 'ready',
        network: 1,
        xdr: 'AAAA',
        signatures: [],
        minTime: 0,
        ...overrides
    }
}

describe('processTx', () => {
    test('skips tx if status is not ready', async () => {
        const cb = jest.fn()
        await finalizer.processTx({...makeTx(), status: 'pending'}, cb)
        expect(cb).toHaveBeenCalledWith()
    })

    test('skips tx if lock fails (status already changed)', async () => {
        const tx = makeTx()
        await storageLayer.dataProvider.saveTransaction(tx)
        // Change status so lock fails
        await storageLayer.dataProvider.updateTxStatus(tx.hash, 'processing', 'ready')

        const cb = jest.fn()
        await finalizer.processTx(tx, cb)
        expect(cb).toHaveBeenCalledWith()
    })

    test('marks expired transaction as failed', async () => {
        const tx = makeTx({maxTime: 500})
        await storageLayer.dataProvider.saveTransaction(tx)
        getUnixTimestamp.mockReturnValue(1000)

        const cb = jest.fn()
        await finalizer.processTx(tx, cb)

        const stored = await storageLayer.dataProvider.findTransaction(tx.hash)
        expect(stored.status).toBe('failed')
        expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })

    test('processes callback when callbackUrl is set', async () => {
        const tx = makeTx({callbackUrl: 'http://example.com/cb'})
        await storageLayer.dataProvider.saveTransaction(tx)

        const cb = jest.fn()
        await finalizer.processTx(tx, cb)

        expect(processCallback).toHaveBeenCalled()
        const stored = await storageLayer.dataProvider.findTransaction(tx.hash)
        expect(stored.status).toBe('processed')
        expect(cb).toHaveBeenCalledWith(null)
    })

    test('submits transaction when submit is true', async () => {
        const tx = makeTx({submit: true})
        await storageLayer.dataProvider.saveTransaction(tx)

        const cb = jest.fn()
        await finalizer.processTx(tx, cb)

        expect(submitTransaction).toHaveBeenCalled()
        const stored = await storageLayer.dataProvider.findTransaction(tx.hash)
        expect(stored.status).toBe('processed')
        expect(stored.submitted).toBe(1000)
        expect(cb).toHaveBeenCalledWith(null)
    })

    test('marks tx as failed when callback throws', async () => {
        processCallback.mockRejectedValue(new Error('callback failed'))
        const tx = makeTx({callbackUrl: 'http://example.com/cb'})
        await storageLayer.dataProvider.saveTransaction(tx)

        const cb = jest.fn()
        await finalizer.processTx(tx, cb)

        const stored = await storageLayer.dataProvider.findTransaction(tx.hash)
        expect(stored.status).toBe('failed')
        expect(stored.error).toBe('callback failed')
        expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })

    test('marks tx as failed when submission throws', async () => {
        submitTransaction.mockRejectedValue(new Error('submission failed'))
        const tx = makeTx({submit: true})
        await storageLayer.dataProvider.saveTransaction(tx)

        const cb = jest.fn()
        await finalizer.processTx(tx, cb)

        const stored = await storageLayer.dataProvider.findTransaction(tx.hash)
        expect(stored.status).toBe('failed')
        expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })
})

describe('resetProcessingStatus', () => {
    test('resets processing transactions to ready', async () => {
        await storageLayer.dataProvider.saveTransaction({hash: 'tx1', status: 'processing', minTime: 0})
        await storageLayer.dataProvider.saveTransaction({hash: 'tx2', status: 'processing', minTime: 0})
        await storageLayer.dataProvider.saveTransaction({hash: 'tx3', status: 'pending', minTime: 0})

        await finalizer.resetProcessingStatus()

        expect((await storageLayer.dataProvider.findTransaction('tx1')).status).toBe('ready')
        expect((await storageLayer.dataProvider.findTransaction('tx2')).status).toBe('ready')
        expect((await storageLayer.dataProvider.findTransaction('tx3')).status).toBe('pending')
    })
})
