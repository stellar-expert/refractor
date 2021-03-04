const {StrKey} = require('stellar-sdk'),
    {standardError} = require('./std-error'),
    {resolveNetwork, resolveNetworkId} = require('./network-resolver'),
    TxModel = require('../models/tx-model')

const maxAgeDays = 30

/**
 *
 * @param {Transaction} tx
 * @param {'pubnet'|'testnet'} network
 * @param {String}callbackUrl
 * @param {Boolean} submit
 * @param {Array<String>} desiredSigners
 * @param {Number} expires
 * @returns {TxModel}
 */
function parseTxParams(tx, {network, callbackUrl, submit, desiredSigners, expires = 0}) {
    const now = Math.floor(new Date().getTime() / 1000)
    const txInfo = new TxModel()
    txInfo.network = resolveNetworkId(network)
    txInfo.xdr = tx.toXDR()
    txInfo.signatures = []

    if (callbackUrl) {
        if (!/^http(s)?:\/\/[-a-zA-Z0-9_+.]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_+.~#?&/=]*)?$/m.test(callbackUrl))
            throw standardError(400, 'Invalid URL supplied in "callbackUrl" parameter.')
        txInfo.callbackUrl = callbackUrl
    }
    if (desiredSigners && desiredSigners.length) {
        if (!(desiredSigners instanceof Array))
            throw standardError(400, 'Invalid "requestedSigners" parameter. Expected an array of Stellar public keys.')
        for (const key of desiredSigners)
            if (!StrKey.isValidEd25519PublicKey(key))
                throw standardError(400, `Invalid "requestedSigners" parameter. Key ${key} is not a valid Stellar public key.`)
        txInfo.desiredSigners = desiredSigners
    }

    txInfo.minTime = parseInt(tx.timeBounds.minTime) || 0

    if (expires) {
        if (expires > 2147483647 || expires < 0)
            throw standardError(400, `Invalid "expires" parameter. ${expires} is not a valid UNIX date.`)
        if (expires < now)
            throw standardError(400, `Invalid "expires" parameter. ${expires} date has already passed.`)
        if (expires > now + maxAgeDays * 24 * 60 * 60)
            throw standardError(400, `Invalid "expires" parameter. Transactions can be stored for no more than ${maxAgeDays} days.`)
    }

    //retrieve expiration time from the transaction itself
    const txExpiration = parseInt(tx.timeBounds.maxTime)
    if (txExpiration && txExpiration < now)
        throw standardError(400, `Invalid transactions "timebounds.maxTime" value - the transaction already expired.`)
    if (txExpiration > 0 && txExpiration < expires && txExpiration < now + maxAgeDays * 24 * 60 * 60) {
        expires = txExpiration
    }

    txInfo.maxTime = expires || (now + maxAgeDays * 24 * 60 * 60)

    if (submit === true) {
        txInfo.submit = true
    }
    return txInfo
}


function sliceTx(tx) {
    const signatures = tx.signatures.slice()
    tx._signatures = []
    return {tx, signatures}
}

module.exports = {parseTxParams, sliceTx}