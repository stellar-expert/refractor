const InMemoryDataProvider = require('../storage/inmemory-data-provider')

let provider

beforeEach(async () => {
    provider = new InMemoryDataProvider()
    await provider.init()
})

describe('saveTransaction / findTransaction', () => {
    test('stores and retrieves a transaction', async () => {
        const tx = {hash: 'abc123', status: 'pending', xdr: 'AAAA'}
        await provider.saveTransaction(tx)
        const found = await provider.findTransaction('abc123')
        expect(found).toEqual(tx)
    })

    test('returns undefined for unknown hash', async () => {
        const found = await provider.findTransaction('nonexistent')
        expect(found).toBeUndefined()
    })

    test('overwrites existing transaction on same hash', async () => {
        await provider.saveTransaction({hash: 'abc', status: 'pending'})
        await provider.saveTransaction({hash: 'abc', status: 'ready'})
        const found = await provider.findTransaction('abc')
        expect(found.status).toBe('ready')
    })
})

describe('updateTransaction', () => {
    test('applies update and returns true', async () => {
        await provider.saveTransaction({hash: 'tx1', status: 'pending', xdr: 'X'})
        const result = await provider.updateTransaction('tx1', {status: 'ready'})
        expect(result).toBe(true)
        const found = await provider.findTransaction('tx1')
        expect(found.status).toBe('ready')
    })

    test('returns false for non-existent hash', async () => {
        const result = await provider.updateTransaction('missing', {status: 'ready'})
        expect(result).toBe(false)
    })

    test('returns false when expectedCurrentStatus does not match', async () => {
        await provider.saveTransaction({hash: 'tx1', status: 'pending'})
        const result = await provider.updateTransaction('tx1', {status: 'ready'}, 'processing')
        expect(result).toBe(false)
        const found = await provider.findTransaction('tx1')
        expect(found.status).toBe('pending')
    })

    test('succeeds when expectedCurrentStatus matches', async () => {
        await provider.saveTransaction({hash: 'tx1', status: 'pending'})
        const result = await provider.updateTransaction('tx1', {status: 'ready'}, 'pending')
        expect(result).toBe(true)
    })
})

describe('updateTxStatus', () => {
    test('updates status field', async () => {
        await provider.saveTransaction({hash: 'tx1', status: 'pending'})
        await provider.updateTxStatus('tx1', 'ready', 'pending')
        const found = await provider.findTransaction('tx1')
        expect(found.status).toBe('ready')
    })

    test('stores error message when error is provided', async () => {
        await provider.saveTransaction({hash: 'tx1', status: 'processing'})
        await provider.updateTxStatus('tx1', 'failed', 'processing', new Error('boom'))
        const found = await provider.findTransaction('tx1')
        expect(found.status).toBe('failed')
        expect(found.error).toBe('boom')
    })
})

describe('listTransactions', () => {
    beforeEach(async () => {
        await provider.saveTransaction({hash: 'a', status: 'pending', minTime: 100})
        await provider.saveTransaction({hash: 'b', status: 'ready', minTime: 200})
        await provider.saveTransaction({hash: 'c', status: 'ready', minTime: 300})
    })

    test('filters by equality', async () => {
        const cursor = provider.listTransactions({status: 'ready'})
        const results = await cursor.toArray()
        expect(results).toHaveLength(2)
        expect(results.every(r => r.status === 'ready')).toBe(true)
    })

    test('filters with $lte operator', async () => {
        const cursor = provider.listTransactions({status: 'ready', minTime: {$lte: 250}})
        const results = await cursor.toArray()
        expect(results).toHaveLength(1)
        expect(results[0].hash).toBe('b')
    })

    test('async iterator works with for-await-of', async () => {
        const results = []
        const cursor = provider.listTransactions({status: 'ready'})
        for await (const tx of cursor) {
            results.push(tx)
        }
        expect(results).toHaveLength(2)
    })

    test('returns empty when no matches', async () => {
        const cursor = provider.listTransactions({status: 'processed'})
        const results = await cursor.toArray()
        expect(results).toHaveLength(0)
    })
})
