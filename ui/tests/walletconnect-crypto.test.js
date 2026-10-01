import {ed25519} from '@noble/curves/ed25519.js'
import {sha256} from '@noble/hashes/sha2.js'
import {
    base58btc,
    bytesToHex,
    deriveSymKey,
    didKey,
    generateX25519,
    open,
    randomBytes,
    seal,
    signRelayJwt,
    topicOf
} from '../signer/walletconnect/wc-crypto'

const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function decodeBase58(str) {
    let value = 0n
    for (const char of str) {
        value = value * 58n + BigInt(base58Alphabet.indexOf(char))
    }
    const bytes = []
    while (value > 0n) {
        bytes.unshift(Number(value & 0xffn))
        value >>= 8n
    }
    const leadingZeros = str.match(/^1*/)[0].length
    return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes])
}

function decodeBase64Url(str) {
    return Buffer.from(str, 'base64url')
}

describe('envelope', () => {
    test('seal/open round-trip', () => {
        const key = randomBytes(32)
        const payload = {id: 1, jsonrpc: '2.0', method: 'wc_sessionPing', params: {text: 'привіт'}}
        const message = seal(key, payload)
        expect(typeof message).toBe('string')
        expect(open(key, message)).toEqual(payload)
    })

    test('envelope layout is type byte, 12-byte iv and ciphertext with 16-byte tag', () => {
        const raw = Buffer.from(seal(randomBytes(32), {}), 'base64')
        expect(raw[0]).toBe(0)
        expect(raw.length).toBe(1 + 12 + 2 + 16)
    })

    test('uses a fresh iv for every message', () => {
        const key = randomBytes(32)
        expect(seal(key, {a: 1})).not.toBe(seal(key, {a: 1}))
    })

    test('rejects tampered messages', () => {
        const key = randomBytes(32)
        const raw = Buffer.from(seal(key, {a: 1}), 'base64')
        raw[raw.length - 1] ^= 1
        expect(() => open(key, raw.toString('base64'))).toThrow()
    })

    test('rejects messages encrypted with a different key', () => {
        expect(() => open(randomBytes(32), seal(randomBytes(32), {a: 1}))).toThrow()
    })

    test('rejects unsupported envelope types', () => {
        const key = randomBytes(32)
        const raw = Buffer.from(seal(key, {a: 1}), 'base64')
        raw[0] = 1
        expect(() => open(key, raw.toString('base64'))).toThrow('Unsupported envelope type 1')
    })
})

describe('key agreement', () => {
    test('topic is sha256 hash of the key', () => {
        const key = randomBytes(32)
        expect(topicOf(key)).toBe(Buffer.from(sha256(key)).toString('hex'))
        expect(topicOf(key)).toMatch(/^[0-9a-f]{64}$/)
    })

    test('both peers derive the same session key', () => {
        const a = generateX25519()
        const b = generateX25519()
        const keyA = deriveSymKey(a.priv, bytesToHex(b.pub))
        const keyB = deriveSymKey(b.priv, bytesToHex(a.pub))
        expect(keyA).toHaveLength(32)
        expect(bytesToHex(keyA)).toBe(bytesToHex(keyB))
        expect(bytesToHex(keyA)).not.toBe(bytesToHex(deriveSymKey(generateX25519().priv, bytesToHex(b.pub))))
    })
})

describe('base58btc', () => {
    test('encodes known vectors', () => {
        expect(base58btc(new Uint8Array())).toBe('')
        expect(base58btc(new TextEncoder().encode('Hello World!'))).toBe('2NEpo7TZRRrLZSi2U')
        expect(base58btc(new Uint8Array([0, 0, 1]))).toBe('112')
        expect(base58btc(new Uint8Array([0xff]))).toBe('5Q')
    })

    test('round-trips random data', () => {
        const bytes = randomBytes(34)
        bytes[0] = 0
        expect(bytesToHex(decodeBase58(base58btc(bytes)))).toBe(bytesToHex(bytes))
    })
})

describe('relay auth', () => {
    test('did:key encodes ed25519 multicodec prefix and public key', () => {
        const pub = ed25519.getPublicKey(ed25519.utils.randomSecretKey())
        const did = didKey(pub)
        //all ed25519 did:key identifiers share this prefix
        expect(did).toMatch(/^did:key:z6Mk/)
        const decoded = decodeBase58(did.substring('did:key:z'.length))
        expect([...decoded.subarray(0, 2)]).toEqual([0xed, 0x01])
        expect(bytesToHex(decoded.subarray(2))).toBe(bytesToHex(pub))
    })

    test('JWT is signed by the issuer key', () => {
        const before = Math.floor(Date.now() / 1000)
        const jwt = signRelayJwt('wss://relay.walletconnect.org')
        const parts = jwt.split('.')
        expect(parts).toHaveLength(3)
        expect(jwt).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
        expect(JSON.parse(decodeBase64Url(parts[0]))).toEqual({alg: 'EdDSA', typ: 'JWT'})
        const payload = JSON.parse(decodeBase64Url(parts[1]))
        expect(payload).toMatchObject({aud: 'wss://relay.walletconnect.org'})
        expect(payload.sub).toMatch(/^[0-9a-f]{64}$/)
        expect(payload.iat).toBeGreaterThanOrEqual(before)
        expect(payload.exp - payload.iat).toBe(86400)
        const pub = decodeBase58(payload.iss.substring('did:key:z'.length)).subarray(2)
        const signature = decodeBase64Url(parts[2])
        const data = new TextEncoder().encode(parts[0] + '.' + parts[1])
        expect(ed25519.verify(new Uint8Array(signature), data, pub)).toBe(true)
    })

    test('every JWT uses a new client key', () => {
        const iss = jwt => JSON.parse(decodeBase64Url(jwt.split('.')[1])).iss
        expect(iss(signRelayJwt('wss://a'))).not.toBe(iss(signRelayJwt('wss://a')))
    })
})
