import {ed25519, x25519} from '@noble/curves/ed25519.js'
import {sha256} from '@noble/hashes/sha2.js'
import {hkdf} from '@noble/hashes/hkdf.js'
import {bytesToHex, concatBytes, hexToBytes, randomBytes, utf8ToBytes} from '@noble/hashes/utils.js'
import {chacha20poly1305} from '@noble/ciphers/chacha.js'

export {bytesToHex, hexToBytes, randomBytes}

const ivLength = 12
//multicodec prefix for ed25519 public keys used in did:key identifiers
const ed25519Multicodec = new Uint8Array([0xed, 0x01])
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * Derive relay topic from a symmetric key
 * @param {Uint8Array} key
 * @return {string}
 */
export function topicOf(key) {
    return bytesToHex(sha256(key))
}

/**
 * Generate ephemeral X25519 key pair for session key agreement
 * @return {{priv: Uint8Array, pub: Uint8Array}}
 */
export function generateX25519() {
    const priv = x25519.utils.randomSecretKey()
    return {priv, pub: x25519.getPublicKey(priv)}
}

/**
 * Derive session symmetric key from own private key and peer public key (X25519 + HKDF-SHA256)
 * @param {Uint8Array} priv
 * @param {string} peerPubHex
 * @return {Uint8Array}
 */
export function deriveSymKey(priv, peerPubHex) {
    return hkdf(sha256, x25519.getSharedSecret(priv, hexToBytes(peerPubHex)), undefined, undefined, 32)
}

/**
 * Encrypt JSON payload into type 0 envelope
 * @param {Uint8Array} key
 * @param {*} payload
 * @return {string} - Base64-encoded envelope
 */
export function seal(key, payload) {
    const iv = randomBytes(ivLength)
    const sealed = chacha20poly1305(key, iv).encrypt(utf8ToBytes(JSON.stringify(payload)))
    return toBase64(concatBytes(new Uint8Array([0]), iv, sealed))
}

/**
 * Decrypt type 0 envelope
 * @param {Uint8Array} key
 * @param {string} message - Base64-encoded envelope
 * @return {*}
 */
export function open(key, message) {
    const raw = fromBase64(message)
    if (raw[0] !== 0)
        throw new Error(`Unsupported envelope type ${raw[0]}`)
    const iv = raw.subarray(1, 1 + ivLength)
    const decrypted = chacha20poly1305(key, iv).decrypt(raw.subarray(1 + ivLength))
    return JSON.parse(new TextDecoder().decode(decrypted))
}

/**
 * Encode ed25519 public key as did:key identifier
 * @param {Uint8Array} pub
 * @return {string}
 */
export function didKey(pub) {
    return 'did:key:z' + base58btc(concatBytes(ed25519Multicodec, pub))
}

/**
 * Create relay client auth JWT signed with a random ed25519 client key
 * @param {string} relayUrl - JWT audience
 * @param {number} [ttl] - Lifetime in seconds
 * @return {string}
 */
export function signRelayJwt(relayUrl, ttl = 86400) {
    const secret = ed25519.utils.randomSecretKey()
    const iat = Math.floor(Date.now() / 1000)
    const header = {alg: 'EdDSA', typ: 'JWT'}
    const payload = {
        iss: didKey(ed25519.getPublicKey(secret)),
        sub: bytesToHex(randomBytes(32)),
        aud: relayUrl,
        iat,
        exp: iat + ttl
    }
    const data = encodeJwtPart(header) + '.' + encodeJwtPart(payload)
    return data + '.' + toBase64Url(ed25519.sign(utf8ToBytes(data), secret))
}

/**
 * Encode bytes as base58btc (Bitcoin alphabet)
 * @param {Uint8Array} bytes
 * @return {string}
 */
export function base58btc(bytes) {
    let value = 0n
    for (const b of bytes) {
        value = (value << 8n) + BigInt(b)
    }
    let res = ''
    while (value > 0n) {
        res = base58Alphabet[Number(value % 58n)] + res
        value /= 58n
    }
    //each leading zero byte is encoded as '1'
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
        res = '1' + res
    }
    return res
}

function encodeJwtPart(obj) {
    return toBase64Url(utf8ToBytes(JSON.stringify(obj)))
}

function toBase64(bytes) {
    let bin = ''
    for (const b of bytes) {
        bin += String.fromCharCode(b)
    }
    return btoa(bin)
}

function fromBase64(str) {
    const bin = atob(str)
    const res = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) {
        res[i] = bin.charCodeAt(i)
    }
    return res
}

function toBase64Url(bytes) {
    return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
