const FsDataProvider = require('./fs-data-provider'),
    MongodbDataProvider = require('./mongodb-data-provider'),
    MongodbFirestoreDataProvider = require('./mongodb-firestore-data-provider'),
    InMemoryDataProvider = require('./inmemory-data-provider'),
    {storage} = require('../app.config.json')

class StorageLayer {
    async initDataProvider(providerName = storage) {
        if (!this.dataProvider) {
            let provider
            switch (providerName) {
                case 'fs':
                    provider = new FsDataProvider()
                    break
                case 'mongodb':
                    provider = new MongodbDataProvider()
                    break
                case 'mongodb+firestore':
                    provider = new MongodbFirestoreDataProvider()
                    break
                case 'inmemory':
                    provider = new InMemoryDataProvider()
                    break
                default:
                    throw new Error(`Unsupported data provider storage engine: ${providerName}`)

            }
            await provider.init()
            this.dataProvider = provider
        }
        return this.dataProvider
    }

    /**
     * @type {DataProvider}
     */
    dataProvider
}

const storageLayer = new StorageLayer()

module.exports = storageLayer