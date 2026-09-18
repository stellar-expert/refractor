const mockHorizonTransaction = jest.fn()

jest.mock('@stellar/stellar-sdk', () => {
    const actual = jest.requireActual('@stellar/stellar-sdk')

    class Server {
        constructor(url) {
            this.url = url
        }

        transactions() {
            return {
                transaction: hash => ({call: () => mockHorizonTransaction(this.url, hash)})
            }
        }
    }

    return {...actual, Horizon: {...actual.Horizon, Server}}
})
jest.mock('@stellar-expert/tx-signers-inspector', () => ({inspectTransactionSigners: jest.fn()}))
jest.mock('../infrastructure/api', () => ({apiCall: jest.fn()}))

import {Keypair} from '@stellar/stellar-sdk'
import {inspectTransactionSigners} from '@stellar-expert/tx-signers-inspector'
import {apiCall} from '../infrastructure/api'
import config from '../app.config.json'
import {validateNewTx, apiSubmitTx, loadTx, checkTxSubmitted} from '../infrastructure/tx-dispatcher'
import {buildTx, txHash, mockSchema} from './helpers/tx-fixtures'

const {horizon} = config.networks.testnet

function txPayload(overrides = {}) {
    return {network: 'testnet', xdr: buildTx().toXDR(), ...overrides}
}

describe('validateNewTx', () => {
    test('returns normalized payload for a valid transaction', async () => {
        const data = txPayload({unknownField: 'ignored'})
        await expect(validateNewTx(data)).resolves.toEqual({network: 'testnet', xdr: data.xdr})
    })

    test('rejects unknown network', async () => {
        await expect(validateNewTx(txPayload({network: 'futurenet'}))).rejects.toThrow('Invalid network')
    })

    test('rejects transaction that fails to parse', async () => {
        await expect(validateNewTx(txPayload({xdr: 'not-an-xdr'}))).rejects.toThrow('Invalid transaction xdr')
        await expect(validateNewTx(txPayload({xdr: ''}))).rejects.toThrow('Invalid transaction xdr')
    })

    test('keeps the submit flag only when strictly true', async () => {
        await expect(validateNewTx(txPayload({submit: true}))).resolves.toMatchObject({submit: true})
        const res = await validateNewTx(txPayload({submit: 'true'}))
        expect(res).not.toHaveProperty('submit')
    })

    test('accepts valid callback URLs', async () => {
        const urls = [
            'https://my-service.com/success.php',
            'http://example.com',
            'https://hooks.my-app.io/tx?ref=1&x=y',
            //TLDs longer than 4 characters, including the placeholder example shown in the form
            'https://my.service/success.php',
            'https://refractor.stellar.expert/callback',
            'https://hooks.example.network/'
        ]
        for (const callback of urls) {
            await expect(validateNewTx(txPayload({callback}))).resolves.toMatchObject({callbackUrl: callback})
        }
    })

    test('rejects malformed callback URLs', async () => {
        for (const callback of ['ftp://my.service/x', 'my.service/x', 'https://localhost/x', 'javascript:alert(1)']) {
            await expect(validateNewTx(txPayload({callback}))).rejects.toThrow('Invalid callback URL')
        }
    })

    test('accepts future UNIX timestamp expiration as string or number', async () => {
        const future = Math.floor(Date.now() / 1000) + 3600
        await expect(validateNewTx(txPayload({expires: String(future)}))).resolves.toMatchObject({expires: String(future)})
        await expect(validateNewTx(txPayload({expires: future}))).resolves.toMatchObject({expires: future})
    })

    test('rejects UNIX timestamp out of range', async () => {
        await expect(validateNewTx(txPayload({expires: '9999999999'}))).rejects.toThrow('UNIX timestamp expected')
    })

    test('converts ISO date expiration to UNIX timestamp', async () => {
        const iso = new Date(Date.now() + 86400000).toISOString()
        await expect(validateNewTx(txPayload({expires: iso}))).resolves.toMatchObject({expires: Math.floor(Date.parse(iso) / 1000)})
    })

    test('rejects unparseable expiration date', async () => {
        await expect(validateNewTx(txPayload({expires: 'tomorrow'}))).rejects.toThrow('unknown data format')
    })

    test('rejects expiration in the past', async () => {
        await expect(validateNewTx(txPayload({expires: '2020-11-29T09:29:13Z'}))).rejects.toThrow('only dates in the future allowed')
        await expect(validateNewTx(txPayload({expires: '1600000000'}))).rejects.toThrow('only dates in the future allowed')
    })

    test('validates desired signers and drops empty entries', async () => {
        const signer = Keypair.random().publicKey()
        await expect(validateNewTx(txPayload({desiredSigners: [signer, '', null]}))).resolves.toMatchObject({desiredSigners: [signer]})
        await expect(validateNewTx(txPayload({desiredSigners: ['GABC']}))).rejects.toThrow('Invalid signer public key - GABC')
        const res = await validateNewTx(txPayload({desiredSigners: []}))
        expect(res).not.toHaveProperty('desiredSigners')
    })
})

describe('checkTxSubmitted', () => {
    test('marks transaction as processed when Horizon reports successful execution', async () => {
        mockHorizonTransaction.mockResolvedValue({created_at: '2026-01-02T03:04:05Z', successful: true})
        const info = {hash: 'abc', network: 'testnet', status: 'ready'}
        const res = await checkTxSubmitted(info)
        expect(mockHorizonTransaction).toHaveBeenCalledWith(horizon, 'abc')
        expect(res).toBe(info)
        expect(info.status).toBe('processed')
        expect(info.submitted).toEqual(new Date('2026-01-02T03:04:05Z'))
    })

    test('marks transaction as failed when it failed on the ledger', async () => {
        mockHorizonTransaction.mockResolvedValue({created_at: '2026-01-02T03:04:05Z', successful: false})
        const info = {hash: 'abc', network: 'public', status: 'ready'}
        await checkTxSubmitted(info)
        expect(mockHorizonTransaction).toHaveBeenCalledWith(config.networks.public.horizon, 'abc')
        expect(info.status).toBe('failed')
    })

    test('leaves the transaction untouched when Horizon does not know it', async () => {
        mockHorizonTransaction.mockRejectedValue(new Error('Not Found'))
        const info = {hash: 'abc', network: 'testnet', status: 'ready'}
        await checkTxSubmitted(info)
        expect(info).toEqual({hash: 'abc', network: 'testnet', status: 'ready'})
    })
})

describe('loadTx', () => {
    test('rejects invalid transaction hash without calling the API', async () => {
        await expect(loadTx('xyz')).rejects.toThrow('Invalid transaction hash: xyz')
        await expect(loadTx()).rejects.toThrow('Invalid transaction hash: (empty)')
        await expect(loadTx('g'.repeat(64))).rejects.toThrow('Invalid transaction hash')
        expect(apiCall).not.toHaveBeenCalled()
    })

    test('loads pending transaction and computes the signing schema', async () => {
        const source = Keypair.random()
        const tx = buildTx({source})
        const hash = txHash(tx)
        const schema = mockSchema([source.publicKey()])
        apiCall.mockResolvedValue({hash, network: 'testnet', xdr: tx.toXDR(), status: 'pending', signatures: []})
        inspectTransactionSigners.mockResolvedValue(schema)

        const info = await loadTx(hash)

        expect(apiCall).toHaveBeenCalledWith('tx/' + hash)
        expect(mockHorizonTransaction).not.toHaveBeenCalled()
        const [inspectedTx, options] = inspectTransactionSigners.mock.calls[0]
        expect(inspectedTx.source).toBe(source.publicKey())
        expect(options).toEqual({horizon})
        expect(info.schema).toBe(schema)
        expect(info.readyToSubmit).toBe(false)
    })

    test('checks the ledger for ready transactions and passes signer keys to the feasibility check', async () => {
        const source = Keypair.random()
        const tx = buildTx({source})
        const hash = txHash(tx)
        const schema = mockSchema([source.publicKey()], {feasible: true})
        apiCall.mockResolvedValue({hash, network: 'testnet', xdr: tx.toXDR(), status: 'ready', signatures: [{key: source.publicKey()}]})
        inspectTransactionSigners.mockResolvedValue(schema)
        mockHorizonTransaction.mockResolvedValue({created_at: '2026-01-02T03:04:05Z', successful: true})

        const info = await loadTx(hash)

        expect(mockHorizonTransaction).toHaveBeenCalledWith(horizon, hash)
        expect(info.status).toBe('processed')
        expect(schema.checkFeasibility).toHaveBeenCalledWith([source.publicKey()])
        expect(info.readyToSubmit).toBe(true)
    })

    test('propagates API errors', async () => {
        apiCall.mockRejectedValue(new Error('Not Found'))
        await expect(loadTx('a'.repeat(64))).rejects.toThrow('Not Found')
    })
})

describe('apiSubmitTx', () => {
    test('validates the payload, posts it, and prepares the stored transaction', async () => {
        const source = Keypair.random()
        const tx = buildTx({source})
        const hash = txHash(tx)
        const schema = mockSchema([source.publicKey()])
        apiCall.mockResolvedValue({hash, network: 'testnet', xdr: tx.toXDR(), status: 'pending', signatures: []})
        inspectTransactionSigners.mockResolvedValue(schema)

        const result = await apiSubmitTx({network: 'testnet', xdr: tx.toXDR(), submit: true, callback: 'https://my-service.com/cb', expires: '', desiredSigners: []})

        expect(apiCall).toHaveBeenCalledWith('tx', {
            network: 'testnet',
            xdr: tx.toXDR(),
            submit: true,
            callbackUrl: 'https://my-service.com/cb'
        }, {method: 'POST'})
        expect(result.hash).toBe(hash)
        expect(result.schema).toBe(schema)
        expect(result.readyToSubmit).toBe(false)
    })

    test('does not call the API when validation fails', async () => {
        await expect(apiSubmitTx({network: 'testnet', xdr: 'bad'})).rejects.toThrow('Invalid transaction xdr')
        expect(apiCall).not.toHaveBeenCalled()
    })
})
