import {Account, Asset, Keypair, Networks, Operation, TransactionBuilder} from '@stellar/stellar-sdk'

export const testnetPassphrase = Networks.TESTNET

/**
 * Build a testnet payment transaction
 * @param {{source?: Keypair, memo?: Memo, timebounds?: {minTime: number, maxTime: number}, ledgerbounds?: {minLedger: number, maxLedger: number}, sign?: boolean}} [params]
 * @return {Transaction}
 */
export function buildTx({source = Keypair.random(), memo, timebounds, ledgerbounds, sign = false} = {}) {
    const builder = new TransactionBuilder(new Account(source.publicKey(), '100'), {fee: '100', networkPassphrase: testnetPassphrase})
        .addOperation(Operation.payment({destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '10'}))
    if (memo) {
        builder.addMemo(memo)
    }
    if (timebounds) {
        builder.setTimebounds(timebounds.minTime, timebounds.maxTime)
    } else {
        builder.setTimeout(300)
    }
    if (ledgerbounds) {
        builder.setLedgerbounds(ledgerbounds.minLedger, ledgerbounds.maxLedger)
    }
    const tx = builder.build()
    if (sign) {
        tx.sign(source)
    }
    return tx
}

export function txHash(tx) {
    return Buffer.from(tx.hash()).toString('hex')
}

/**
 * Fake signing schema mimicking the tx-signers-inspector output
 * @param {string[]} signers
 * @param {{minThreshold?: number, feasible?: boolean}} [params]
 */
export function mockSchema(signers, {minThreshold = 2, feasible = false} = {}) {
    return {
        requirements: [{minThreshold, signers: signers.map(key => ({key, weight: 1}))}],
        getAllPotentialSigners: () => signers,
        checkFeasibility: jest.fn(() => feasible)
    }
}

/**
 * Transaction info in the shape produced by tx-dispatcher.loadTx()
 * @param {{}} [overrides]
 */
export function buildTxInfo(overrides = {}) {
    const source = Keypair.random()
    const cosigner = Keypair.random()
    const tx = buildTx({source})
    return {
        hash: txHash(tx),
        network: 'testnet',
        xdr: tx.toXDR(),
        status: 'pending',
        signatures: [],
        submit: false,
        readyToSubmit: false,
        schema: mockSchema([source.publicKey(), cosigner.publicKey()]),
        ...overrides
    }
}

/**
 * Promise with externally controlled resolution
 */
export function deferred() {
    let resolve, reject
    const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
    })
    return {promise, resolve, reject}
}
