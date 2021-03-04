class TxModel {
    /**
     * Transaction hash.
     * @type {String}
     */
    hash

    /**
     * Network (0-pubnet or 1-testnet)
     * @type {Number}
     */
    network

    /**
     * Transaction XDR without signatures.
     * @type {Buffer}
     */
    xdr

    /**
     * Applied transaction signatures.
     * @type {TxSignature[]}
     */
    signatures

    /**
     * Submit transactions to the network once signed.
     * @type {Boolean}
     */
    submit

    /**
     * Callback URL where the transaction will be sent once signed.
     * @type {String}
     */
    callbackUrl

    /**
     * List of signers requested by the tx author.
     * @type {String[]}
     */
    desiredSigners

    /**
     * Point in time when a transaction becomes valid (populated from a tx timebounds).
     * @type {Number}
     */
    minTime

    /**
     * Expiration date (UNIX timestamp).
     * @type {Number}
     */
    maxTime

    /**
     * Current tx status.
     * @type {TxStatus}
     */
    status

    /**
     * Submitted transaction timestamp (UNIX timestamp).
     * @type {Number}
     */
    submitted
}

module.exports = TxModel

/**
 * @typedef {'pending'|'ready'|'processing'|'processed'|'failed'} TxStatus
 */