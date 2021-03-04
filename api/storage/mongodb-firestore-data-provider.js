const {Firestore, FieldPath} = require('@google-cloud/firestore'),
    {firestore} = require('../app.config.json'),
    MongodbDataProvider = require('./mongodb-data-provider')

/**
 *
 * @param {TxModel} txModel
 * @return {Object}
 */
function txModelToPlainObject(txModel) {
    const res = {...txModel},
        {signatures} = res

    if (signatures) {
        res.signatures = signatures.map(s => ({...s}))
    }
    return res
}

class MongodbFirestoreDataProvider extends MongodbDataProvider {
    async init() {
        await super.init()
        this.firestore = new Firestore({
            projectId: firestore.project_id,
            credentials: firestore,
            ignoreUndefinedProperties: true
        })
        console.log(`Connected to Firestore data source ${firestore.project_id}`)
    }

    /**
     * @type {Firestore}
     */
    firestore

    getDoc(hash) {
        return this.firestore.doc('tx/' + hash)
    }

    /**
     * Store transaction.
     * @param {TxModel} txModel
     * @returns {Promise}
     */
    async saveTransaction(txModel) {
        await super.saveTransaction(txModel)
        await this.getDoc(txModel.hash).set(txModelToPlainObject(txModel))
    }

    async updateTransaction(hash, update, expectedCurrentStatus) {
        const res = await super.updateTransaction(hash, update, expectedCurrentStatus)
        if (res) {
            await this.getDoc(hash).update(txModelToPlainObject(update))
        }
        return res
    }
}

module.exports = MongodbFirestoreDataProvider