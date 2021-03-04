const {Server, TransactionBuilder} = require('stellar-sdk'),
    createQueue = require('fastq'),
    {resolveNetwork} = require('../network-resolver')

const servers = {}

/**
 * @param {TxModel} txInfo
 * @return {Promise}
 */
let submitTransactionWorker = function (txInfo) {
    let horizon = servers[txInfo.network]
    const network = resolveNetwork(txInfo.network)
    if (!horizon) {
        servers[txInfo.network] = horizon = new Server(network.horizon)
    }
    return horizon.submitTransaction(TransactionBuilder.fromXDR(txInfo.xdr, network.passphrase), {skipMemoRequiredCheck: true})
}

const horizonQueue = createQueue((txInfo, cb) => {
    submitTransactionWorker(txInfo)
        .then(res => cb(null, res))
        .catch(e => {
            if (e.response && e.response.status) {
                const horizonError = new Error('Transaction submission failed')
                horizonError.status = e.response.status
                if (e.response.data) {
                    horizonError.result_codes = e.response.data.extras.result_codes
                }
                e = horizonError
            }
            cb(e)
        })
}, 20)

function setSubmitTransactionCallback(callback) {
    submitTransactionWorker = callback
}

/**
 * Submit a prepared transaction to Horizon.
 * @param {TxModel} txInfo
 * @return {Promise<TxModel>}
 */
function submitTransaction(txInfo) {
    return new Promise((resolve, reject) => {
        horizonQueue.push(txInfo, function (err, result) {
            if (err) return reject(err)
            txInfo.result = result
            resolve(txInfo)
        })
    })
}

module.exports = {submitTransaction, setSubmitTransactionCallback}