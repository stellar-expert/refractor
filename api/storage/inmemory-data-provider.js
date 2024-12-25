const DataProvider = require('./data-provider'),
    {matchPredicate} = require('./simple-predicate-matcher')

class InMemoryDataProvider extends DataProvider {
    storage

    async init() {
        this.storage = {}
    }

    async saveTransaction(txModel) {
        this.storage[txModel.hash] = txModel
        await this.save()
    }

    async findTransaction(hash) {
        return this.storage[hash]
    }

    async updateTransaction(hash, update, expectedCurrentStatus) {
        const tx = await this.findTransaction(hash)
        if (!tx) return false
        if (expectedCurrentStatus !== undefined && tx.status !== expectedCurrentStatus) return false
        Object.assign(tx, update)
        await this.save()
        return true
    }

    listTransactions(filter) {
        const matchResult = Object.values(this.storage)
            .filter(tx => matchPredicate(tx, filter))
        return {
            [Symbol.asyncIterator]() {
                return {
                    matchResult,
                    cursor: 0,
                    next() {
                        if (this.cursor >= this.matchResult.length) return Promise.resolve({done: true})
                        return Promise.resolve({value: this.matchResult[this.cursor++], done: false})
                    }
                }
            },
            async toArray() {
                return matchResult.slice()
            }
        }
    }

    async save() {
        //no op
    }
}

module.exports = InMemoryDataProvider