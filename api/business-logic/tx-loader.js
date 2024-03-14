const {normalizeNetworkName, resolveNetwork} = require('./network-resolver'),
    storageLayer = require('../storage/storage-layer'),
    {TransactionBuilder} = require('@stellar/stellar-sdk')

async function loadRehydrateTx(hash) {
    const txInfo = await storageLayer.dataProvider.findTransaction(hash)
    if (!txInfo) {
        const notFound = new Error(`Transaction ${hash} not found.`)
        notFound.status = 404
        return Promise.reject(notFound)
    }
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
    for (const {key, signature} of txInfo.signatures) {
        tx.addSignature(key, signature.toString('base64'))
    }
    res.xdr = tx.toXDR()
    return res
}

module.exports = {loadRehydrateTx, rehydrateTx}