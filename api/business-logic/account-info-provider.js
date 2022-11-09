const {getAllSourceAccounts} = require('./tx-helpers')
const {normalizeNetworkName} = require('./network-resolver')
const {loadAccountsInfo, initPgDbPools} = require('../storage/core-db-data-source')
const {networks} = require('../app.config.json')

let coredbSourceAllowed

function initCoreConnectionsPool() {
    if (coredbSourceAllowed !== undefined) return
    if (Object.values(networks).some(n => !!n.coredb)) {
        initPgDbPools()
        coredbSourceAllowed = true
        return
    }
    coredbSourceAllowed = false
}

async function loadTxSourceAccountsInfo(tx, network) {
    initCoreConnectionsPool()
    if (!coredbSourceAllowed) return
    //find all source accounts participating in the tx
    const sourceAccounts = getAllSourceAccounts(tx)
    //load information about every source account directly from StellarCore database
    return await loadAccountsInfo(normalizeNetworkName(network), sourceAccounts)
}

module.exports = {loadTxSourceAccountsInfo}