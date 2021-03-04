class TxSignature {
    /**
     * Signature pubkey.
     * @type {String}
     */
    key

    /**
     * Raw signature.
     * @type {Buffer}
     */
    signature

    toJSON() {
        return {key: this.key, signature: this.signature.toString('base64')}
    }
}

module.exports = TxSignature