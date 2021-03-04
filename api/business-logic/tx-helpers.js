function getAllSourceAccounts(tx) {
    //handle fee bump tx
    if (tx.feeSource && tx.innerTransaction) {
        //add tx source account by default
        return [tx.feeSource]
    }
    //regular tx
    const sources = {[tx.source]: 1}
    //process source account for each operation
    for (let operation of tx.operations)
        if (operation.source) {
            sources[operation.source] = 1
        }
    //return only unique entries
    return Object.keys(sources)
}

module.exports = {getAllSourceAccounts}