const {xdr, Keypair, StrKey, rpc, TransactionBuilder} = require('@stellar/stellar-sdk')
const {resolveNetwork} = require('./network-resolver')

/**
 * Load accounts info from RPC
 * @param {string} network
 * @param {string[]} accounts
 * @return {Promise<{account_id: string, id: string, signers: {key: string, weight: number, type: string}[], sequence: string, thresholds: {low_threshold: number, med_threshold: number, high_threshold: number}}[]>}
 */
async function loadAccountsInfo(network, accounts) {
    if (accounts.length > 200)
        return batch(network, accounts)
    const {entries} = await invokeRpcMethod(network, 'getLedgerEntries', {keys: prepareAccountsQuery(accounts)})
    return entries.map(entry => {
        const parsed = xdr.LedgerEntryData.fromXdr(entry.xdr, 'base64')
        const value = parsed.value
        const id = accountToString(value.accountId)
        const accountSigners = []
        const [masterWeight, low_threshold, med_threshold, high_threshold] = value.thresholds.toBytes()
        if (masterWeight > 0) {
            accountSigners.push(formatSigner(id, masterWeight))
        }
        if (value.signers.length) {
            for (const signer of value.signers) {
                const {key, weight} = signer
                if (key.type !== 'signerKeyTypeEd25519')
                    continue //TODO: add support for preauthorized transactions and other signer types
                accountSigners.push(formatSigner(accountToString(key), weight))
            }
        }

        return {
            id,
            account_id: id,
            signers: accountSigners,
            sequence: value.seqNum.toString(),
            thresholds: {low_threshold, med_threshold, high_threshold}
        }
    })
}

async function batch(network, accounts) {
    const batchSize = 200
    const res = []
    for (let i = 0; i < accounts.length; i += batchSize) {
        const accountsBatch = accounts.slice(i, i + batchSize)
        const data = await loadAccountsInfo(network, accountsBatch)
        res.push(...data)
    }
    return res
}

function prepareAccountsQuery(accounts) {
    return accounts.map(address => xdr.LedgerKey.account(
        new xdr.LedgerKeyAccount({
            accountId: Keypair.fromPublicKey(address).xdrAccountId()
        })
    ).toXdr('base64'))
}

function formatSigner(key, weight, type = 'ed25519_public_key') {
    return {
        type,
        key,
        weight
    }
}

//an account id decodes as PublicKey and an account signer as SignerKey - separate unions
const ed25519ArmTypes = ['publicKeyTypeEd25519', 'signerKeyTypeEd25519']

function accountToString(accountXdr) {
    if (!accountXdr)
        return accountXdr
    if (!ed25519ArmTypes.includes(accountXdr.type))
        throw new TypeError('Unsupported account type: ' + accountXdr.type)
    return StrKey.encodeEd25519PublicKey(accountXdr.value.toBytes())
}

function invokeRpcMethod(network, method, params) {
    const data = {
        jsonrpc: '2.0',
        id: 8675309,
        method,
        params
    }
    return fetch(resolveNetwork(network).rpc, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'}
    })
        .then(res => res.json())
        .then(res => {
            if (res.error)
                throw new Error('RPC error: ' + res.error.message + '\n' + res.error.data)
            return res.result
        })
}

/**
 *
 * @param {TxModel} tx
 * @returns {Promise<boolean>}
 */
let submitTransactionImpl = async function (tx) {
    const networkProps = resolveNetwork(tx.network)
    const rpcServer = new rpc.Server(networkProps.rpc, {
        allowHttp: true,
        timeout: 20_000
    })
    for (let i = 0; i < 3; i++) { //try submitting up to 3 times
        const res = await sendTxToRpc(rpcServer, networkProps, tx)
        if (typeof res === 'string') {
            throw new Error(res)
        }
        if (res)
            break   //processed or failed
    }
    const {status, resultXdr} = await rpcServer.pollTransaction(tx.hash, {
        attempts: 12,
        sleepStrategy: iter => 2000 + iter * 500 //2s + 0.5s per iteration backoff
    })
    if (status === 'SUCCESS')
        return true
    if (resultXdr)
        throw new Error(formatErrorResult(resultXdr, 'base64'))
    throw new Error('Failed to submit transaction')
}

/**
 * @param {rpc.Server} rpcServer
 * @param {Object} networkProps
 * @param {TxModel} tx
 * @returns {Promise<boolean|string>}
 */
async function sendTxToRpc(rpcServer, networkProps, tx) {
    try {
        for (let i = 0; i < 3; i++) {
            const {
                status,
                errorResult
            } = await rpcServer.sendTransaction(TransactionBuilder.fromXdr(tx.xdr, networkProps.passphrase))

            switch (status) {
                case 'PENDING': //transaction is being considered by consensus
                case 'DUPLICATE': //transaction is already PENDING
                    return true
                case 'ERROR': //transaction rejected by transaction engine error: set when status is "ERROR". Base64 encoded, XDR serialized 'TransactionResult'
                    let err = 'Unknown tx submission error'
                    if (errorResult) {
                        return formatErrorResult(errorResult)
                    }
                    /*if (res.diagnosticEvents?.length) {
                        err += '\nDiagnostics: \n' + res.diagnosticEvents.map(e => e.toXDR('base64')).join('\n')
                    }*/
                    throw new Error(err)
                case 'TRY_AGAIN_LATER':
                    continue
            }
            throw new Error('Unknown tx submission status: ' + status)
        }
        return false //received TRY_AGAIN_LATER several times in a row
    } catch (e) {
        console.error('Failed to submit tx', e)
        return false
    }
}

function formatErrorResult(errorResult) {
    if (typeof errorResult === 'string') {
        errorResult = xdr.TransactionResult.fromXdr(errorResult, 'base64')
    }
    return 'Tx error: ' + errorResult.result.type
}

/**
 *
 * @param {TxModel} tx
 * @returns {Promise<boolean|undefined>}
 */
async function submitTransaction(tx) {
    return submitTransactionImpl(tx)
}

/**
 * Replace submitTransaction implementation with a custom one for testing purposes.
 * @param {function} fn
 */
function fakeSubmitTransaction(fn) {
    submitTransactionImpl = fn
}

module.exports = {loadAccountsInfo, submitTransaction, fakeSubmitTransaction}