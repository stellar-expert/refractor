const {TransactionBuilder} = require('@stellar/stellar-sdk')
const storageLayer = require('../storage/storage-layer')
const {normalizeNetworkName, resolveNetwork} = require('./network-resolver')
const {toBuffer} = require('./xdr-utils')
const {refreshTxStatus} = require('./tx-status-refresher')

async function loadRehydrateTx(hash) {
    let txInfo = await storageLayer.dataProvider.findTransaction(hash)
    if (!txInfo) {
        const notFound = new Error(`Transaction ${hash} not found.`)
        notFound.status = 404
        return Promise.reject(notFound)
    }
    //verify on-chain state of transactions that failed during automatic processing
    txInfo = await refreshTxStatus(txInfo)
    return rehydrateTx(txInfo)
}

/**
 *
 * @param {TxModel} txInfo
 * @return {TxModel}
 */
function rehydrateTx(txInfo) {
    const {network, xdr, ...res} = txInfo
    const tx = TransactionBuilder.fromXDR(xdr, resolveNetwork(network).passphrase)
    //rehydrate - set network and add signatures from tx info
    res.network = normalizeNetworkName(network)
    if (txInfo.signatures instanceof Array) {
        for (const {key, signature} of txInfo.signatures) {
            //signature is stored either as raw bytes or as base64-encoded string
            const encoded = typeof signature === 'string' ? signature : toBuffer(signature).toString('base64')
            tx.addSignature(key, encoded)
        }
    }
    res.xdr = tx.toXDR()
    return res
}

module.exports = {loadRehydrateTx, rehydrateTx}