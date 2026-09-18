const storageLayer = require('../storage/storage-layer')
const InMemoryDataProvider = require('../storage/inmemory-data-provider')

describe('initDataProvider', () => {
    test('throws for unsupported storage engine', async () => {
        await expect(storageLayer.initDataProvider('bogus')).rejects.toThrow('Unsupported data provider storage engine: bogus')
        expect(storageLayer.dataProvider).toBeUndefined()
    })

    test('initializes the provider once and reuses it', async () => {
        const provider = await storageLayer.initDataProvider('inmemory')
        expect(provider).toBeInstanceOf(InMemoryDataProvider)
        expect(storageLayer.dataProvider).toBe(provider)
        //subsequent calls ignore the engine name and return the initialized provider
        expect(await storageLayer.initDataProvider('bogus')).toBe(provider)
    })
})
