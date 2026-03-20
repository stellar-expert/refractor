const {getAllSourceAccounts} = require('./tx-helpers')
const {normalizeNetworkName} = require('./network-resolver')
const {loadAccountsInfo} = require('./rpc-connector')

async function loadTxSourceAccountsInfo(tx, network) {
    //find all source accounts participating in the tx
    const sourceAccounts = getAllSourceAccounts(tx)
    //load information about every source account
    return await loadAccountsInfo(normalizeNetworkName(network), sourceAccounts)
}

module.exports = {loadTxSourceAccountsInfo}