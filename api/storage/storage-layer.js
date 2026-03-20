const {storage} = require('../app.config.json')
const FsDataProvider = require('./fs-data-provider')
const MongodbDataProvider = require('./mongodb-data-provider')
const MongodbFirestoreDataProvider = require('./mongodb-firestore-data-provider')
const InMemoryDataProvider = require('./inmemory-data-provider')

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