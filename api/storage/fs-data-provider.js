const InMemoryDataProvider = require('./inmemory-data-provider'),
    path = require('path'),
    fs = require('fs').promises

const fileName = path.join(__dirname, '../', 'data.json')

class FsDataProvider extends InMemoryDataProvider {
    /**
     * @type {Object}
     */
    storage

    async init() {
        try {
            const raw = await fs.readFile(fileName)
            this.storage = JSON.parse(raw.toString())
        } catch (e) {
            if (e.code !== 'ENOENT')
                throw e
            this.storage = {}
        }
    }

    async save() {
        await fs.writeFile(fileName, JSON.stringify(this.storage, null, '  '))
    }
}

module.exports = FsDataProvider