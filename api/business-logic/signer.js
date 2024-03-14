const {TransactionBuilder, FeeBumpTransaction, Keypair} = require('@stellar/stellar-sdk'),
    {inspectTransactionSigners} = require('@stellar-expert/tx-signers-inspector'),
    TxSignature = require('../models/tx-signature'),
    {resolveNetwork, resolveNetworkParams} = require('./network-resolver'),
    {standardError} = require('./std-error'),
    storageLayer = require('../storage/storage-layer'),
    {loadTxSourceAccountsInfo} = require('./account-info-provider'),
    {sliceTx, parseTxParams} = require('./tx-params-parser'),
    {rehydrateTx} = require('./tx-loader'),
    {hintMatchesKey, hintToMask} = require('./signature-hint-utils')

class Signer {
    /**
     * @param {Object} request
     */
    constructor(request) {
        const {xdr, network} = request
        let txEnvelope
        try {
            txEnvelope = TransactionBuilder.fromXDR(xdr, resolveNetwork(network).passphrase)
        } catch (e) {
            throw standardError(400, `Invalid transaction XDR`)
        }
        if (txEnvelope instanceof FeeBumpTransaction)
            throw standardError(406, `FeeBump transactions not supported`)

        const {tx, signatures} = sliceTx(txEnvelope)
        this.tx = tx
        this.hashRaw = tx.hash()
        this.hash = this.hashRaw.toString('hex')
        this.signaturesToProcess = signatures
        this.txInfo = parseTxParams(tx, request)
        this.txInfo.hash = this.hash
        this.accepted = []
        this.rejected = []
        this.status = 'created' //always assume that the tx is new one until we fetched details from db
    }

    /**
     * @type {Transaction}
     */
    tx
    /**
     * @type {String}
     */
    hash
    /**
     * @type {Buffer}
     */
    hashRaw
    /**
     * @type {'draft'|'created'|'updated'|'unchanged'}
     */
    status = 'draft'
    /**
     * @type {TxModel}
     */
    txInfo
    /**
     * @type {Array<TxSignature>}
     */
    accepted
    /**
     * @type {Array<TxSignature>}
     */
    rejected
    /**
     * @type {Array<Object>}
     */
    signaturesToProcess
    /**
     * @type {Array<String>}
     */
    potentialSigners
    /**
     * @type {Object}
     */
    schema

    async init() {
        //check if we have already processed it
        let txInfo = await storageLayer.dataProvider.findTransaction(this.hash)
        if (txInfo) {
            this.txInfo = txInfo //replace tx info with info from db
            this.status = 'unchanged'
        } else {
            this.status = 'created'
        }
        const {horizon} = resolveNetworkParams(this.txInfo.network)
        const accountsInfo = await loadTxSourceAccountsInfo(this.tx, this.txInfo.network)
        //discover signers
        this.schema = await inspectTransactionSigners(this.tx, {horizon, accountsInfo})
        //get all signers that can potentially sign the transaction
        this.potentialSigners = this.schema.getAllPotentialSigners()
        return this
    }

    get isReady() {
        return this.schema.checkFeasibility(this.txInfo.signatures.map(s => s.key))
    }

    /**
     * @param {Object} rawSignature
     */
    processSignature(rawSignature) {
        //get props from the raw signature
        const {hint, signature} = rawSignature._attributes
        //init wrapped signature object
        const signaturePair = new TxSignature()
        signaturePair.signature = signature
        //find matching signer from potential signers list
        signaturePair.key = this.potentialSigners
            .find(key => hintMatchesKey(hint, key) && this.verifySignature(key, signature))
        //verify the signature
        if (signaturePair.key) {
            //filter out duplicates
            if (!this.txInfo.signatures.some(s => s.key === signaturePair.key)) {
                //add to the valid signatures list
                this.txInfo.signatures.push(signaturePair)
                this.accepted.push(signaturePair)
            }
        } else {
            signaturePair.key = hintToMask(hint)
            this.rejected.push(signaturePair)
        }
    }

    verifySignature(key, signature) {
        return Keypair.fromPublicKey(key).verify(this.hashRaw, signature)
    }

    processNewSignatures() {
        if (!this.signaturesToProcess.length) return
        //skip existing
        const newSignatures = this.signaturesToProcess.filter(sig => {
            const newSignature = sig.signature().toString('base64')
            return !this.txInfo.signatures.some(existing => existing.signature === newSignature)
        })
        //search for invalid signature
        for (let signature of newSignatures) {
            this.processSignature(signature)
        }
        //save changes if any
        if (this.accepted.length && this.status !== 'created') {
            this.setStatus('updated')
        }
        this.signaturesToProcess = []
    }

    async saveChanges() {
        //save changes if any
        if (!['created', 'updated'].includes(this.status)) return
        if (!this.txInfo.status) {
            this.txInfo.status = 'pending'
        }
        if (this.txInfo.status === 'pending' && this.isReady) {
            this.txInfo.status = 'ready'
        }
        await storageLayer.dataProvider.saveTransaction(this.txInfo)
    }


    /**
     * @param {'draft'|'created'|'updated'|'unchanged'} newStatus
     */
    setStatus(newStatus) {
        if (this.status === 'created' || this.status === 'updated') return
        this.status = newStatus
    }

    toJSON() {
        return {...rehydrateTx(this.txInfo), changes: {accepted: this.accepted, rejected: this.rejected}}
    }
}

module.exports = Signer
