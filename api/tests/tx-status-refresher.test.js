jest.mock('../storage/storage-layer')
jest.mock('../business-logic/timestamp-utils')

const storageLayer = require('../storage/storage-layer')
const InMemoryDataProvider = require('../storage/inmemory-data-provider')
const {getUnixTimestamp} = require('../business-logic/timestamp-utils')
const {resolveNetwork} = require('../business-logic/network-resolver')
const {refreshTxStatus, shouldRefreshStatus, refreshInterval} = require('../business-logic/tx-status-refresher')

const now = 1_700_000_000
const hash = 'c'.repeat(64)
const originalFetch = global.fetch
let consoleErrorSpy

function horizonResponse(status, body) {
    return {status, json: async () => body}
}

function mockHorizon(response) {
    global.fetch = jest.fn(async () => response)
}

async function storeTx(overrides = {}) {
    const tx = {hash, network: 1, xdr: 'AAAA', signatures: [], status: 'failed', submit: true, error: 'Tx error: txBadSeq', ...overrides}
    await storageLayer.dataProvider.saveTransaction({...tx})
    return tx
}

beforeEach(async () => {
    const provider = new InMemoryDataProvider()
    await provider.init()
    storageLayer.dataProvider = provider
    getUnixTimestamp.mockReturnValue(now)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    global.fetch = originalFetch
    consoleErrorSpy.mockRestore()
})

describe('shouldRefreshStatus', () => {
    test('is true for failed transactions never checked before', () => {
        expect(shouldRefreshStatus({status: 'failed'})).toBe(true)
    })

    test('is true for processed auto-submit transactions without confirmed submission', () => {
        expect(shouldRefreshStatus({status: 'processed', submit: true})).toBe(true)
    })

    test('is false for processed transactions without auto-submit', () => {
        expect(shouldRefreshStatus({status: 'processed'})).toBe(false)
    })

    test('is false for pending, ready and processing transactions', () => {
        for (const status of ['pending', 'ready', 'processing']) {
            expect(shouldRefreshStatus({status, submit: true})).toBe(false)
        }
    })

    test('is false once the submission has been confirmed', () => {
        expect(shouldRefreshStatus({status: 'processed', submit: true, submitted: now - 10})).toBe(false)
    })

    test('is false when checked less than the refresh interval ago', () => {
        expect(shouldRefreshStatus({status: 'failed', updated: now - refreshInterval + 1})).toBe(false)
    })

    test('is true when the last check is older than the refresh interval', () => {
        expect(shouldRefreshStatus({status: 'failed', updated: now - refreshInterval - 1})).toBe(true)
    })

    test('is false for missing transaction', () => {
        expect(shouldRefreshStatus(null)).toBe(false)
    })
})

describe('refreshTxStatus', () => {
    test('marks failed transaction as processed when Horizon reports it as successful', async () => {
        const tx = await storeTx()
        mockHorizon(horizonResponse(200, {hash, successful: true, created_at: '2024-05-01T10:20:30Z'}))

        const res = await refreshTxStatus(tx)

        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(global.fetch.mock.calls[0][0]).toBe(resolveNetwork('testnet').horizon.replace(/\/$/, '') + '/transactions/' + hash)
        expect(res.status).toBe('processed')
        expect(res.submitted).toBe(Math.floor(Date.parse('2024-05-01T10:20:30Z') / 1000))
        expect(res.updated).toBe(now)
        expect(res.error).toBeNull()
        //changes are persisted
        const stored = await storageLayer.dataProvider.findTransaction(hash)
        expect(stored).toMatchObject({status: 'processed', submitted: res.submitted, updated: now, error: null})
    })

    test('only bumps the updated timestamp when the transaction is not found on the ledger', async () => {
        const tx = await storeTx()
        mockHorizon(horizonResponse(404, {status: 404}))

        const res = await refreshTxStatus(tx)

        expect(res.status).toBe('failed')
        expect(res.submitted).toBeUndefined()
        expect(res.error).toBe('Tx error: txBadSeq')
        expect(res.updated).toBe(now)
        expect((await storageLayer.dataProvider.findTransaction(hash)).updated).toBe(now)
    })

    test('keeps failed status when the transaction failed on the ledger as well', async () => {
        const tx = await storeTx()
        mockHorizon(horizonResponse(200, {hash, successful: false, created_at: '2024-05-01T10:20:30Z'}))

        const res = await refreshTxStatus(tx)

        expect(res.status).toBe('failed')
        expect(res.submitted).toBeUndefined()
        expect(res.updated).toBe(now)
    })

    test('bumps the updated timestamp and logs the error when Horizon is unavailable', async () => {
        const tx = await storeTx()
        mockHorizon(horizonResponse(503, {}))

        const res = await refreshTxStatus(tx)

        expect(res.status).toBe('failed')
        expect(res.updated).toBe(now)
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Failed to check on-chain status of tx ${hash}`, expect.any(Error))
    })

    test('bumps the updated timestamp when the request fails', async () => {
        const tx = await storeTx()
        global.fetch = jest.fn(async () => {
            throw new Error('network down')
        })

        const res = await refreshTxStatus(tx)

        expect(res.status).toBe('failed')
        expect(res.updated).toBe(now)
        expect(consoleErrorSpy).toHaveBeenCalled()
    })

    test('does not query Horizon when checked recently', async () => {
        const tx = await storeTx({updated: now - 60})
        global.fetch = jest.fn()

        const res = await refreshTxStatus(tx)

        expect(global.fetch).not.toHaveBeenCalled()
        expect(res.updated).toBe(now - 60)
    })

    test('re-checks after the refresh interval has passed', async () => {
        const tx = await storeTx({updated: now - refreshInterval - 1})
        mockHorizon(horizonResponse(404, {}))

        const res = await refreshTxStatus(tx)

        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(res.updated).toBe(now)
    })

    test('does not query Horizon for transactions that are not eligible', async () => {
        global.fetch = jest.fn()
        for (const tx of [
            await storeTx({status: 'pending'}),
            await storeTx({status: 'ready'}),
            await storeTx({status: 'processed', submit: false}),
            await storeTx({status: 'processed', submitted: now - 100})
        ]) {
            const res = await refreshTxStatus(tx)
            expect(res).toBe(tx)
        }
        expect(global.fetch).not.toHaveBeenCalled()
    })

    test('refreshes processed auto-submit transaction without confirmed submission', async () => {
        const tx = await storeTx({status: 'processed', error: undefined})
        mockHorizon(horizonResponse(200, {hash, successful: true, created_at: '2024-05-01T10:20:30Z'}))

        const res = await refreshTxStatus(tx)

        expect(res.status).toBe('processed')
        expect(res.submitted).toBe(Math.floor(Date.parse('2024-05-01T10:20:30Z') / 1000))
    })

    test('does not apply changes when the stored status changed concurrently', async () => {
        const tx = await storeTx()
        //status changed in the database after the tx info has been loaded
        await storageLayer.dataProvider.updateTxStatus(hash, 'processed', 'failed')
        mockHorizon(horizonResponse(200, {hash, successful: true, created_at: '2024-05-01T10:20:30Z'}))

        const res = await refreshTxStatus(tx)

        expect(res.status).toBe('failed') //local copy left untouched
        expect(res.updated).toBeUndefined()
        const stored = await storageLayer.dataProvider.findTransaction(hash)
        expect(stored.status).toBe('processed')
        expect(stored.updated).toBeUndefined()
    })
})
