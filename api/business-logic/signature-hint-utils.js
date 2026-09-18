const {Keypair} = require('@stellar/stellar-sdk')
const {parseDecoratedSignature} = require('./xdr-utils')

/**
 * Convert the signature hint to the StrKey mask.
 * @param {Buffer|Uint8Array} hint - Hint to convert.
 * @return {string}
 */
function hintToMask(hint) {
    const partialPublicKey = Buffer.concat([Buffer.alloc(28), hint])
    const hintKeypair = new Keypair({type: 'ed25519', publicKey: partialPublicKey})
    const pk = hintKeypair.publicKey()
    return pk.substr(0, 1) + '_'.repeat(46) + pk.substr(47, 5) + '_'.repeat(4)
}

/**
 * Format the signature hint to the friendly form for UI.
 * @param {Buffer|Uint8Array} hint - Hint to convert.
 * @return {string}
 */
function formatHint(hint) {
    const mask = hintToMask(hint)
    return mask.substr(0, 2) + '…' + mask.substr(46)
}

/**
 * Check if the hint matches the specific key.
 * @param {Buffer|Uint8Array} hint - Hint to check.
 * @param {string} key - Key to compare.
 * @return {boolean}
 */
function hintMatchesKey(hint, key) {
    return hintToMask(hint).substr(47, 5) === key.substr(47, 5)
}

/**
 * Find matching key by the signature hint from a list of available keys.
 * @param {Buffer|Uint8Array} hint - Hint to look for.
 * @param {Array<string>} allKeys - Array of potentially matching keys.
 * @return {string|null}
 */
function findKeysByHint(hint, allKeys) {
    return allKeys.find(key => hintMatchesKey(hint, key))
}

/**
 * Find a signature by public key from the list of signatures.
 * @param {Buffer|Uint8Array} hashRaw
 * @param {string} pubkey
 * @param {Array<xdr.DecoratedSignature>} allSignatures
 * @returns {xdr.DecoratedSignature}
 */
function findSignatureByKey(hashRaw, pubkey, allSignatures = []) {
    const keypair = Keypair.fromPublicKey(pubkey)
    return allSignatures.find(sig => {
        const {hint, signature} = parseDecoratedSignature(sig)
        return hintMatchesKey(hint, pubkey) && keypair.verify(hashRaw, signature)
    })
}

module.exports = {
    hintToMask,
    hintMatchesKey,
    formatHint,
    findKeysByHint,
    findSignatureByKey
}
