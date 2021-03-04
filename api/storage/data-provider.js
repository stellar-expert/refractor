class DataProvider {
    async init() {
    }

    /**
     * Store transaction.
     * @param {TxModel} txModel
     * @returns {Promise}
     */
    async saveTransaction(txModel) {
        throw new Error('Not implemented')
    }

    /**
     *
     * @param {String} hash
     * @return {Promise<TxModel>}
     */
    async findTransaction(hash) {
        throw new Error('Not implemented')
    }

    /**
     * Get transactions iterator filtered by
     * @param {Object} filter
     * @return {TxModelsCursor}
     */
    listTransactions(filter) {
        throw new Error('Not implemented')
    }


    /**
     *
     * @param {String} hash
     * @param {Object} update
     * @param {TxStatus} [expectedCurrentStatus]
     * @return {Promise<Boolean>}
     */
    async updateTransaction(hash, update, expectedCurrentStatus = undefined) {
        throw new Error('Not implemented')
    }

    /**
     *
     * @param {String} hash
     * @param {TxStatus} newStatus
     * @param {TxStatus} [expectedCurrentStatus]
     * @return {Promise<Boolean>}
     */
    async updateTxStatus(hash, newStatus, expectedCurrentStatus = undefined) {
        return this.updateTransaction(hash, {status: newStatus}, expectedCurrentStatus)
    }
}

module.exports = DataProvider

/**
 * @callback TxModelsCursor
 * @async
 * @generator
 * @yields {TxModel}
 */
