jest.mock('../storage/storage-layer')
jest.mock('../business-logic/account-info-provider')

const express = require('express')
const bodyParser = require('body-parser')
const {Keypair, Networks, TransactionBuilder, Account, Operation, Asset} = require('@stellar/stellar-sdk')
const storageLayer = require('../storage/storage-layer')
const InMemoryDataProvider = require('../storage/inmemory-data-provider')
const {loadTxSourceAccountsInfo} = require('../business-logic/account-info-provider')
const {name, version} = require('../package.json')
const registerRoutes = require('../api/api-routes')

const sourceKp = Keypair.random()
const cosignerKp = Keypair.random()

let server
let baseUrl

function buildTx() {
    return new TransactionBuilder(new Account(sourceKp.publicKey(), '100'), {fee: '100', networkPassphrase: Networks.TESTNET})
        .addOperation(Operation.payment({destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '10'}))
        .setTimeout(300)
        .build()
}

function accountInfo(thresholds) {
    return [{
        id: sourceKp.publicKey(),
        account_id: sourceKp.publicKey(),
        sequence: '100',
        signers: [
            {key: sourceKp.publicKey(), weight: 1, type: 'ed25519_public_key'},
            {key: cosignerKp.publicKey(), weight: 1, type: 'ed25519_public_key'}
        ],
        thresholds
    }]
}

async function request(path, options = {}) {
    const res = await fetch(baseUrl + path, options)
    return {status: res.status, headers: res.headers, body: await res.json()}
}

function postTx(payload) {
    return request('/tx', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })
}

beforeAll(async () => {
    const app = express()
    app.use(bodyParser.json())
    registerRoutes(app)
    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', resolve)
    })
    baseUrl = 'http://127.0.0.1:' + server.address().port
})

afterAll(async () => {
    await new Promise(resolve => server.close(resolve))
})

beforeEach(async () => {
    const provider = new InMemoryDataProvider()
    await provider.init()
    storageLayer.dataProvider = provider
    loadTxSourceAccountsInfo.mockResolvedValue(accountInfo({low_threshold: 0, med_threshold: 1, high_threshold: 1}))
})

describe('GET /', () => {
    test('returns service info', async () => {
        const {status, body} = await request('/')
        expect(status).toBe(200)
        expect(body.service).toBe(name)
        expect(body.version).toBe(version)
        expect(new Date(body.started).getTime()).toBeLessThanOrEqual(Date.now())
    })
})

describe('POST /tx', () => {
    test('stores a new transaction and accepts a valid signature', async () => {
        const tx = buildTx()
        tx.sign(sourceKp)
        const {status, body} = await postTx({xdr: tx.toXDR(), network: 'testnet'})

        expect(status).toBe(200)
        expect(body.hash).toBe(Buffer.from(tx.hash()).toString('hex'))
        expect(body.network).toBe('testnet')
        expect(body.status).toBe('ready') //med threshold 1 is met by the master key
        expect(body.changes.accepted).toEqual([{key: sourceKp.publicKey(), signature: expect.any(String)}])
        expect(body.changes.rejected).toEqual([])
        //stored signatures are re-attached to the returned XDR
        const returned = TransactionBuilder.fromXDR(body.xdr, Networks.TESTNET)
        expect(returned.signatures).toHaveLength(1)
        expect(sourceKp.verify(returned.hash(), returned.signatures[0].signature.toBytes())).toBe(true)
        //transaction is persisted
        const stored = await storageLayer.dataProvider.findTransaction(body.hash)
        expect(stored.status).toBe('ready')
        expect(stored.signatures).toHaveLength(1)
    })

    test('keeps the transaction pending until the threshold is reached and merges signatures', async () => {
        loadTxSourceAccountsInfo.mockResolvedValue(accountInfo({low_threshold: 0, med_threshold: 2, high_threshold: 2}))
        const tx = buildTx()
        const hash = Buffer.from(tx.hash()).toString('hex')

        const firstTx = TransactionBuilder.fromXDR(tx.toXDR(), Networks.TESTNET)
        firstTx.sign(sourceKp)
        const first = await postTx({xdr: firstTx.toXDR(), network: 'testnet', submit: true, callbackUrl: 'https://example.com/callback'})
        expect(first.status).toBe(200)
        expect(first.body.status).toBe('pending')
        expect(first.body.submit).toBe(true)
        expect(first.body.callbackUrl).toBe('https://example.com/callback')

        const secondTx = TransactionBuilder.fromXDR(tx.toXDR(), Networks.TESTNET)
        secondTx.sign(cosignerKp)
        const second = await postTx({xdr: secondTx.toXDR(), network: 'testnet'})
        expect(second.status).toBe(200)
        expect(second.body.hash).toBe(hash)
        expect(second.body.status).toBe('ready')
        expect(second.body.changes.accepted.map(s => s.key)).toEqual([cosignerKp.publicKey()])
        expect(TransactionBuilder.fromXDR(second.body.xdr, Networks.TESTNET).signatures).toHaveLength(2)
    })

    test('rejects signatures from unknown signers', async () => {
        const tx = buildTx()
        tx.sign(Keypair.random())
        const {status, body} = await postTx({xdr: tx.toXDR(), network: 'testnet'})

        expect(status).toBe(200)
        expect(body.status).toBe('pending')
        expect(body.changes.accepted).toEqual([])
        expect(body.changes.rejected).toHaveLength(1)
        expect(body.changes.rejected[0].key).toMatch(/^G_{46}[A-Z2-7]{5}_{4}$/)
    })

    test('returns 400 for invalid XDR', async () => {
        const {status, body} = await postTx({xdr: 'not-a-transaction', network: 'testnet'})
        expect(status).toBe(400)
        expect(body).toEqual({error: 'Invalid transaction XDR', status: 400})
    })

    test('returns 400 for unknown network', async () => {
        const {status, body} = await postTx({xdr: buildTx().toXDR(), network: 'futurenet'})
        expect(status).toBe(400)
        expect(body.error).toMatch(/Unidentified network/)
    })

    test('returns 406 for fee bump transactions', async () => {
        const inner = buildTx()
        inner.sign(sourceKp)
        const feeBump = TransactionBuilder.buildFeeBumpTransaction(Keypair.random(), '200', inner, Networks.TESTNET)
        const {status, body} = await postTx({xdr: feeBump.toXDR(), network: 'testnet'})
        expect(status).toBe(406)
        expect(body.error).toBe('FeeBump transactions not supported')
    })
})

describe('GET /tx/:hash', () => {
    test('returns stored transaction with signatures', async () => {
        const tx = buildTx()
        tx.sign(sourceKp)
        const {body: posted} = await postTx({xdr: tx.toXDR(), network: 'testnet'})

        const {status, body} = await request('/tx/' + posted.hash)
        expect(status).toBe(200)
        expect(body.hash).toBe(posted.hash)
        expect(body.network).toBe('testnet')
        expect(body.xdr).toBe(posted.xdr)
        expect(body.signatures).toEqual([{key: sourceKp.publicKey(), signature: expect.any(String)}])
        expect(body.changes).toBeUndefined()
    })

    test('returns 404 for unknown transaction', async () => {
        const hash = 'a'.repeat(64)
        const {status, body} = await request('/tx/' + hash)
        expect(status).toBe(404)
        expect(body).toEqual({error: 'Transaction ' + hash + ' not found.', status: 404})
    })
})
