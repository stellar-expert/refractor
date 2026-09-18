const storageLayer = require('../storage/storage-layer')
const {resolveNetwork} = require('./network-resolver')
const {getUnixTimestamp} = require('./timestamp-utils')

/**
 * Minimum interval between on-chain status checks for the same transaction (seconds).
 * @type {number}
 */
const refreshInterval = 30 * 60

/**
 * Check whether the stored transaction status may be stale and should be verified against the ledger.
 * Only transactions that failed the automatic processing (or were processed without a confirmed submission)
 * are eligible, and no more often than once per refresh interval.
 * @param {TxModel} txInfo
 * @return {boolean}
 */
function shouldRefreshStatus(txInfo) {
    if (!txInfo || txInfo.submitted)
        return false
    const {status, submit, updated} = txInfo
    if (status !== 'failed' && !(status === 'processed' && submit))
        return false
    if (updated && updated > getUnixTimestamp() - refreshInterval)
        return false
    return true
}

/**
 * Fetch transaction details from Horizon.
 * @param {string|number} network
 * @param {string} hash
 * @return {Promise<{successful: boolean, created_at: string}|null>} - Transaction record or null if not found
 */
async function fetchTxFromHorizon(network, hash) {
    const {horizon} = resolveNetwork(network)
    const res = await fetch(`${horizon.replace(/\/$/, '')}/transactions/${hash}`)
    if (res.status === 404)
        return null
    if (res.status !== 200)
        throw new Error(`Horizon responded with status ${res.status}`)
    return res.json()
}

/**
 * Verify and update state of a transaction that failed the automatic processing.
 * The `updated` timestamp is bumped on every check attempt to throttle Horizon requests.
 * @param {TxModel} txInfo - Stored transaction info
 * @return {Promise<TxModel>} - Transaction info with refreshed status
 */
async function refreshTxStatus(txInfo) {
    if (!shouldRefreshStatus(txInfo))
        return txInfo
    const update = {updated: getUnixTimestamp()}
    try {
        const onChainTx = await fetchTxFromHorizon(txInfo.network, txInfo.hash)
        if (onChainTx && onChainTx.successful) {
            update.status = 'processed'
            update.submitted = Math.floor(Date.parse(onChainTx.created_at) / 1000)
            update.error = null //clear the automatic processing error
        }
    } catch (e) {
        console.error(`Failed to check on-chain status of tx ${txInfo.hash}`, e)
    }
    //conditional update prevents overwriting concurrent status changes
    if (await storageLayer.dataProvider.updateTransaction(txInfo.hash, update, txInfo.status)) {
        Object.assign(txInfo, update)
    }
    return txInfo
}

module.exports = {refreshTxStatus, shouldRefreshStatus, refreshInterval}
