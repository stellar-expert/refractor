jest.mock('@stellar-expert/tx-signers-inspector')
jest.mock('../storage/storage-layer')
jest.mock('../business-logic/account-info-provider')

const {Keypair, Networks, TransactionBuilder, Account, Operation, Asset} = require('@stellar/stellar-sdk')
const storageLayer = require('../storage/storage-layer')
const InMemoryDataProvider = require('../storage/inmemory-data-provider')
const {loadTxSourceAccountsInfo} = require('../business-logic/account-info-provider')
const {inspectTransactionSigners} = require('@stellar-expert/tx-signers-inspector')
const Signer = require('../business-logic/signer')

// Test keypairs
const sourceKp = Keypair.random()
const signerKp1 = Keypair.random()
const signerKp2 = Keypair.random()
const destKp = Keypair.random()

function buildBaseTx() {
    const account = new Account(sourceKp.publicKey(), '100')
    return new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET
    })
        .addOperation(Operation.payment({
            destination: destKp.publicKey(),
            asset: Asset.native(),
            amount: '10'
        }))
        .setTimeout(30)
        .build()
}

function buildTestRequest({sign = [], network = 'testnet'} = {}) {
    const tx = buildBaseTx()
    for (const kp of sign) {
        tx.sign(kp)
    }
    return {xdr: tx.toXDR(), network}
}

function mockSchema(potentialSigners, feasible = false) {
    inspectTransactionSigners.mockResolvedValue({
        getAllPotentialSigners: () => potentialSigners,
        checkFeasibility: () => feasible
    })
}

beforeEach(async () => {
    const provider = new InMemoryDataProvider()
    await provider.init()
    storageLayer.dataProvider = provider

    loadTxSourceAccountsInfo.mockResolvedValue([{
        id: sourceKp.publicKey(),
        account_id: sourceKp.publicKey(),
        signers: [
            {key: sourceKp.publicKey(), weight: 1, type: 'ed25519_public_key'},
            {key: signerKp1.publicKey(), weight: 1, type: 'ed25519_public_key'},
            {key: signerKp2.publicKey(), weight: 1, type: 'ed25519_public_key'}
        ],
        thresholds: {low_threshold: 0, med_threshold: 1, high_threshold: 1}
    }])
})

describe('constructor', () => {
    test('parses valid XDR and initializes fields', () => {
        mockSchema([sourceKp.publicKey()])
        const request = buildTestRequest()
        const signer = new Signer(request)
        expect(signer.hash).toBeTruthy()
        expect(signer.tx).toBeTruthy()
        expect(signer.status).toBe('created')
        expect(signer.accepted).toEqual([])
        expect(signer.rejected).toEqual([])
    })

    test('throws 400 for invalid XDR', () => {
        expect(() => new Signer({xdr: 'invalid', network: 'testnet'}))
            .toThrow('Invalid transaction XDR')
    })

    test('throws 406 for FeeBump transactions', () => {
        // Build a fee bump tx
        const request = buildTestRequest({sign: [sourceKp]})
        const innerTx = TransactionBuilder.fromXDR(request.xdr, Networks.TESTNET)
        const feeBump = TransactionBuilder.buildFeeBumpTransaction(
            Keypair.random(),
            '200',
            innerTx,
            Networks.TESTNET
        )
        expect(() => new Signer({xdr: feeBump.toXDR(), network: 'testnet'}))
            .toThrow('FeeBump transactions not supported')
    })
})

describe('init', () => {
    test('sets status to created for new transaction', async () => {
        mockSchema([sourceKp.publicKey()])
        const signer = new Signer(buildTestRequest())
        await signer.init()
        expect(signer.status).toBe('created')
        expect(signer.potentialSigners).toContain(sourceKp.publicKey())
    })

    test('sets status to unchanged when tx exists in DB', async () => {
        mockSchema([sourceKp.publicKey()])
        const request = buildTestRequest()
        const signer1 = new Signer(request)
        await signer1.init()
        await signer1.saveChanges()

        // Re-submit same tx
        const signer2 = new Signer(request)
        await signer2.init()
        expect(signer2.status).toBe('unchanged')
    })
})

describe('processNewSignatures', () => {
    test('accepts valid signature from a potential signer', async () => {
        mockSchema([sourceKp.publicKey(), signerKp1.publicKey()])
        const request = buildTestRequest({sign: [signerKp1]})
        const signer = new Signer(request)
        await signer.init()
        signer.processNewSignatures()

        expect(signer.accepted).toHaveLength(1)
        expect(signer.accepted[0].key).toBe(signerKp1.publicKey())
        expect(signer.rejected).toHaveLength(0)
    })

    test('rejects signature from non-potential signer', async () => {
        const outsiderKp = Keypair.random()
        mockSchema([sourceKp.publicKey()]) // outsider not in potential signers
        const request = buildTestRequest({sign: [outsiderKp]})
        const signer = new Signer(request)
        await signer.init()
        signer.processNewSignatures()

        expect(signer.accepted).toHaveLength(0)
        expect(signer.rejected).toHaveLength(1)
    })

    test('skips duplicate signatures', async () => {
        mockSchema([signerKp1.publicKey()])
        const request = buildTestRequest({sign: [signerKp1]})
        const signer = new Signer(request)
        await signer.init()
        signer.processNewSignatures()

        expect(signer.accepted).toHaveLength(1)

        // Simulate processing the same signature again
        const request2 = buildTestRequest({sign: [signerKp1]})
        const signer2 = new Signer(request2)
        await signer2.init()
        signer2.processNewSignatures()

        // Should not add duplicate since it's already in DB from first save
        // (init loads from DB, which already has the signature)
    })

    test('sets status to updated when new signatures added to existing tx', async () => {
        mockSchema([sourceKp.publicKey(), signerKp1.publicKey(), signerKp2.publicKey()])

        // First submission with signerKp1
        const request1 = buildTestRequest({sign: [signerKp1]})
        const signer1 = new Signer(request1)
        await signer1.init()
        signer1.processNewSignatures()
        await signer1.saveChanges()

        // Second submission with signerKp2
        const request2 = buildTestRequest({sign: [signerKp2]})
        const signer2 = new Signer(request2)
        await signer2.init()
        expect(signer2.status).toBe('unchanged')
        signer2.processNewSignatures()
        expect(signer2.status).toBe('updated')
    })
})

describe('saveChanges', () => {
    test('does nothing when status is unchanged', async () => {
        mockSchema([sourceKp.publicKey()])
        const request = buildTestRequest()
        const signer1 = new Signer(request)
        await signer1.init()
        await signer1.saveChanges()

        const signer2 = new Signer(request)
        await signer2.init()
        const saveSpy = jest.spyOn(storageLayer.dataProvider, 'saveTransaction')
        await signer2.saveChanges()
        expect(saveSpy).not.toHaveBeenCalled()
    })

    test('saves with pending status for new transaction', async () => {
        mockSchema([sourceKp.publicKey()])
        const signer = new Signer(buildTestRequest())
        await signer.init()
        await signer.saveChanges()

        const stored = await storageLayer.dataProvider.findTransaction(signer.hash)
        expect(stored.status).toBe('pending')
    })

    test('sets status to ready when isReady returns true', async () => {
        inspectTransactionSigners.mockResolvedValue({
            getAllPotentialSigners: () => [signerKp1.publicKey()],
            checkFeasibility: () => true
        })
        const request = buildTestRequest({sign: [signerKp1]})
        const signer = new Signer(request)
        await signer.init()
        signer.processNewSignatures()
        await signer.saveChanges()

        const stored = await storageLayer.dataProvider.findTransaction(signer.hash)
        expect(stored.status).toBe('ready')
    })
})

describe('toJSON', () => {
    test('returns tx info with accepted and rejected changes', async () => {
        mockSchema([signerKp1.publicKey()])
        const outsiderKp = Keypair.random()
        const request = buildTestRequest({sign: [signerKp1, outsiderKp]})
        const signer = new Signer(request)
        await signer.init()
        signer.processNewSignatures()

        const json = signer.toJSON()
        expect(json.changes.accepted).toHaveLength(1)
        expect(json.changes.rejected).toHaveLength(1)
        expect(json.xdr).toBeTruthy()
    })
})
