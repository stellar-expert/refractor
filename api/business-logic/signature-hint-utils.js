const {Keypair} = require('stellar-sdk')

/**
 * Convert the signature hint to the StrKey mask.
 * @param {Buffer} hint - Hint to convert.
 * @return {string}
 */
function hintToMask(hint) {
    const partialPublicKey = Buffer.concat([Buffer.alloc(28), hint]),
        hintKeypair = new Keypair({type: 'ed25519', publicKey: partialPublicKey}),
        pk = hintKeypair.publicKey()
    return pk.substr(0, 1) + '_'.repeat(46) + pk.substr(47, 5) + '_'.repeat(4)
}

/**
 * Format the signature hint to the friendly form for UI.
 * @param {Buffer} hint - Hint to convert.
 * @return {string}
 */
function formatHint(hint) {
    const mask = hintToMask(hint)
    return mask.substr(0, 2) + '…' + mask.substr(46)
}

/**
 * Check if the hint matches the specific key.
 * @param {Buffer} hint - Hint to check.
 * @param {String} key - Key to compare.
 * @return {boolean}
 */
function hintMatchesKey(hint, key) {
    return hintToMask(hint).substr(47, 5) === key.substr(47, 5)
}

/**
 * Find matching key by the signature hint from a list of available keys.
 * @param {Buffer} hint - Hint to look for.
 * @param {Array<String>} allKeys - Array of potentially matching keys.
 * @return {String|null}
 */
function findKeysByHint(hint, allKeys) {
    return allKeys.find(key => hintMatchesKey(hint, key))
}

/**
 * Find a signature by public key from the list of signatures.
 * @param {String} pubkey
 * @param {Array<TxSignature>} allSignatures
 * @returns {*}
 */
function findSignatureByKey(pubkey, allSignatures = []) {
    const matchingSignatures = allSignatures.filter(sig => hintMatchesKey(sig.hint(), pubkey))
    return matchingSignatures.find(sig=>Keypair.fromPublicKey(pubkey))
}

module.exports = {
    hintToMask,
    hintMatchesKey,
    formatHint,
    findKeysByHint,
    findSignatureByKey
}