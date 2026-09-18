/**
 * Convert raw bytes returned by Stellar-sdk to Node.js Buffer.
 * @param {Uint8Array|Buffer} bytes
 * @return {Buffer}
 */
function toBuffer(bytes) {
    if (Buffer.isBuffer(bytes))
        return bytes
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/**
 * Extract hint and signature bytes from XDR DecoratedSignature.
 * @param {xdr.DecoratedSignature} decoratedSignature
 * @return {{hint: Buffer, signature: Buffer}}
 */
function parseDecoratedSignature(decoratedSignature) {
    return {
        hint: toBuffer(decoratedSignature.hint.toBytes()),
        signature: toBuffer(decoratedSignature.signature.toBytes())
    }
}

module.exports = {toBuffer, parseDecoratedSignature}
