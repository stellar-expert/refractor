const MongoClient = require('mongodb').MongoClient,
    {name: appname} = require('../package.json'),
    config = require('../app.config'),
    DataProvider = require('./data-provider'),
    TxSignature = require('../models/tx-signature')

class MongodbDataProvider extends DataProvider {
    async init() {
        const options = {
            appname,
            promoteValues: true,
            promoteLongs: false,
            keepAlive: true,
            useNewUrlParser: true,
            useUnifiedTopology: true,
            authSource: 'admin',
            poolSize: 30
        }
        const connection = await MongoClient.connect(config.db, options)
        this.db = connection.db()
        console.log(`Connected to MongoDB data source ${this.db.databaseName}`)
    }

    /**
     *
     * @type {Db}
     */
    db = null

    /**
     *
     * @type {Collection}
     */
    get txCollection() {
        return this.db.collection('tx')
    }

    /**
     * Store transaction.
     * @param {TxModel} txModel
     * @returns {Promise}
     */
    async saveTransaction(txModel) {
        const {hash, ...otherProps} = txModel
        await this.txCollection
            .updateOne({_id: hash}, {$set: otherProps}, {upsert: true})
    }

    /**
     *
     * @param {String} hash
     * @return {Promise<TxModel>}
     */
    async findTransaction(hash) {
        const doc = await this.txCollection
            .findOne({_id: hash})
        if (!doc) return null
        doc.hash = doc._id
        delete doc._id
        if (doc.signatures) {
            doc.signatures = doc.signatures.map(s => {
                const ts = new TxSignature()
                ts.key = s.key
                ts.signature = s.signature.buffer
                return ts
            })
        }
        return doc
    }

    async updateTransaction(hash, update, expectedCurrentStatus) {
        const filter = {_id: hash}
        if (expectedCurrentStatus !== undefined) {
            filter.status = expectedCurrentStatus
        }
        const {matchedCount} = await this.txCollection
            .updateOne(filter, {$set: update})
        return matchedCount > 0 //success if the operation matched
    }

    listTransactions(filter) {
        const condition = {...filter}
        if (condition.hash) {
            condition._id = condition.hash
            delete condition.hash
        }
        return this.txCollection.find(condition, {
            projection: {
                hash: '$_id',
                _id: 0,
                status: 1,
                network: 1,
                xdr: 1,
                callbackUrl: 1,
                maxTime: 1,
                minTime: 1,
                signatures: 1,
                submit: 1,
                submitted: 1,
                desiredSigners: 1
            }
        })
    }
}

module.exports = MongodbDataProvider