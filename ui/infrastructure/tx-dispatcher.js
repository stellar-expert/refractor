import {TransactionBuilder, StrKey, Horizon} from '@stellar/stellar-sdk'
import {inspectTransactionSigners} from '@stellar-expert/tx-signers-inspector'
import config from '../app.config.json'
import {apiCall} from './api'

const {networks} = config

export async function validateNewTx(data) {
    const res = {
        network: data.network,
        xdr: data.xdr
    }
    //resolve network name
    const networkParams = networks[data.network]
    if (!networkParams)
        throw new Error('Invalid network')
    //assume that a transaction is valid if we can parse it
    try {
        TransactionBuilder.fromXDR(data.xdr, networkParams.passphrase)
        //TODO: add more complex checks in the future
    } catch (e) {
        throw new Error('Invalid transaction xdr')
    }
    //check if auto-submit is set
    if (data.submit === true) {
        res.submit = true
    }
    //validate callback url
    if (data.callback) {
        if (!/^http(s)?:\/\/[-a-zA-Z0-9_+.]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_+.~#?&/=]*)?$/.test(data.callback))
            throw new Error('Invalid callback URL')
        res.callbackUrl = data.callback
    }
    //check and parse expiration date
    if (data.expires) {
        let expires
        if (data.expires.toString().match(/^\d+$/)) {
            expires = parseInt(data.expires, 10)
            //check that input is a valid Unix timestamp
            if (expires < 0 || expires > 2147483648)
                throw new Error('Invalid expiration date - UNIX timestamp expected')
            res.expires = data.expires
        } else {
            const ts = Date.parse(data.expires)
            if (isNaN(ts))
                throw new Error('Invalid expiration date - unknown data format')
            res.expires = ts / 1000 >> 0
        }
        if (res.expires < new Date().getTime() / 1000)
            throw new Error('Invalid expiration date - only dates in the future allowed')
    }
    //validate proposed signers
    if (data.desiredSigners?.length) {
        const nonEmptySigners = data.desiredSigners.filter(s => !!s)
        for (const signer of nonEmptySigners) {
            if (!StrKey.isValidEd25519PublicKey(signer))
                throw new Error('Invalid signer public key - ' + signer)
        }
        res.desiredSigners = nonEmptySigners
    }
    //everything is ok - return processed data
    return res
}

export async function apiSubmitTx(data) {
    //validate and prepare the data
    const parsedData = await validateNewTx(data)
    //submit ot the server
    const txInfo = await apiCall('tx', parsedData, {method: 'POST'})
    return await prepareTxInfo(txInfo)
}

export async function loadTx(txhash) {
    if (typeof txhash !== 'string' || !/^[a-f0-9]{64}$/i.test(txhash))
        throw new Error(`Invalid transaction hash: ${txhash || '(empty)'}`)
    //load from the server
    let txInfo = await apiCall('tx/' + txhash)
    if (txInfo.status === 'ready' || txInfo.status === 'processed') {
        txInfo = await checkTxSubmitted(txInfo)
    }
    return await prepareTxInfo(txInfo)
}

export async function checkTxSubmitted(txInfo) {
    try {
        const server = new Horizon.Server(networks[txInfo.network].horizon)
        const {created_at, successful} = await server.transactions().transaction(txInfo.hash).call()
        txInfo.submitted = new Date(created_at)
        txInfo.status = (successful) ? 'processed' : 'failed'
    } catch (e) {
    }
    return txInfo
}

async function prepareTxInfo(txInfo) {
    //create Transaction object
    const {passphrase, horizon} = networks[txInfo.network]
    const tx = TransactionBuilder.fromXDR(txInfo.xdr, passphrase)
    //discover signers and check whether it is fully signed
    const schema = await inspectTransactionSigners(tx, {horizon})
    txInfo.schema = schema
    txInfo.readyToSubmit = schema.checkFeasibility(txInfo.signatures.map(sig => sig.key))
    return txInfo
    //TODO: fetch info from Horizon for a submitted transaction
}
