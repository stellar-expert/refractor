const mockSendTransaction = jest.fn()
const mockPollTransaction = jest.fn()
const mockServerConstructor = jest.fn()

jest.mock('@stellar/stellar-sdk', () => {
    const actual = jest.requireActual('@stellar/stellar-sdk')

    class Server {
        constructor(...args) {
            mockServerConstructor(...args)
        }

        sendTransaction(...args) {
            return mockSendTransaction(...args)
        }

        pollTransaction(...args) {
            return mockPollTransaction(...args)
        }
    }

    return {...actual, rpc: {...actual.rpc, Server}}
})

const {Keypair, Networks, TransactionBuilder, Account, Operation, Asset, xdr} = require('@stellar/stellar-sdk')
const {submitTransaction} = require('../business-logic/rpc-connector')
const {resolveNetwork} = require('../business-logic/network-resolver')

function buildTxModel() {
    const kp = Keypair.random()
    const tx = new TransactionBuilder(new Account(kp.publicKey(), '100'), {fee: '100', networkPassphrase: Networks.TESTNET})
        .addOperation(Operation.payment({destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '10'}))
        .setTimeout(300)
        .build()
    tx.sign(kp)
    return {
        hash: Buffer.from(tx.hash()).toString('hex'),
        network: 1,
        xdr: tx.toXDR(),
        submit: true,
        status: 'processing'
    }
}

function txResult(resultCode) {
    return new xdr.TransactionResult({
        feeCharged: 100n,
        result: xdr.TransactionResultResult[resultCode](),
        ext: xdr.TransactionResultExt.v0()
    })
}

let consoleErrorSpy

beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    consoleErrorSpy.mockRestore()
})

describe('submitTransaction', () => {
    test('submits the transaction and resolves when the tx succeeds', async () => {
        const txModel = buildTxModel()
        mockSendTransaction.mockResolvedValue({status: 'PENDING', hash: txModel.hash})
        mockPollTransaction.mockResolvedValue({status: 'SUCCESS', resultXdr: txResult('txSuccess')})

        await expect(submitTransaction(txModel)).resolves.toBe(true)

        //server is created for the tx network
        expect(mockServerConstructor).toHaveBeenCalledTimes(1)
        const [rpcUrl, serverOptions] = mockServerConstructor.mock.calls[0]
        expect(rpcUrl).toBe(resolveNetwork('testnet').rpc)
        expect(serverOptions).toMatchObject({allowHttp: true, timeout: 20_000})
        //the parsed transaction is passed to the RPC
        expect(mockSendTransaction).toHaveBeenCalledTimes(1)
        const [sentTx] = mockSendTransaction.mock.calls[0]
        expect(sentTx.toXDR()).toBe(txModel.xdr)
        //polls the tx status by hash with a backoff strategy
        expect(mockPollTransaction).toHaveBeenCalledTimes(1)
        const [polledHash, pollOptions] = mockPollTransaction.mock.calls[0]
        expect(polledHash).toBe(txModel.hash)
        expect(pollOptions.attempts).toBe(12)
        expect(pollOptions.sleepStrategy(0)).toBe(2000)
        expect(pollOptions.sleepStrategy(2)).toBe(3000)
    })

    test('treats DUPLICATE submission status as accepted', async () => {
        const txModel = buildTxModel()
        mockSendTransaction.mockResolvedValue({status: 'DUPLICATE'})
        mockPollTransaction.mockResolvedValue({status: 'SUCCESS'})

        await expect(submitTransaction(txModel)).resolves.toBe(true)
        expect(mockSendTransaction).toHaveBeenCalledTimes(1)
    })

    test('throws formatted error when the RPC rejects the tx with error result', async () => {
        const txModel = buildTxModel()
        mockSendTransaction.mockResolvedValue({status: 'ERROR', errorResult: txResult('txBadSeq')})

        await expect(submitTransaction(txModel)).rejects.toThrow('Tx error: txBadSeq')
        //no retries and no polling for the definitive rejection
        expect(mockSendTransaction).toHaveBeenCalledTimes(1)
        expect(mockPollTransaction).not.toHaveBeenCalled()
    })

    test('retries on TRY_AGAIN_LATER and gives up after 9 attempts', async () => {
        const txModel = buildTxModel()
        mockSendTransaction.mockResolvedValue({status: 'TRY_AGAIN_LATER'})
        mockPollTransaction.mockResolvedValue({status: 'NOT_FOUND'})

        await expect(submitTransaction(txModel)).rejects.toThrow('Failed to submit transaction')
        expect(mockSendTransaction).toHaveBeenCalledTimes(9) //3 rounds x 3 attempts
        expect(mockPollTransaction).toHaveBeenCalledTimes(1)
    })

    test('recovers when a retry after TRY_AGAIN_LATER is accepted', async () => {
        const txModel = buildTxModel()
        mockSendTransaction
            .mockResolvedValueOnce({status: 'TRY_AGAIN_LATER'})
            .mockResolvedValueOnce({status: 'TRY_AGAIN_LATER'})
            .mockResolvedValueOnce({status: 'PENDING'})
        mockPollTransaction.mockResolvedValue({status: 'SUCCESS'})

        await expect(submitTransaction(txModel)).resolves.toBe(true)
        expect(mockSendTransaction).toHaveBeenCalledTimes(3)
    })

    test('retries the whole round when the RPC call throws', async () => {
        const txModel = buildTxModel()
        mockSendTransaction
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({status: 'PENDING'})
        mockPollTransaction.mockResolvedValue({status: 'SUCCESS'})

        await expect(submitTransaction(txModel)).resolves.toBe(true)
        expect(mockSendTransaction).toHaveBeenCalledTimes(2)
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to submit tx', expect.any(Error))
    })

    test('retries the whole round on ERROR status without error result', async () => {
        const txModel = buildTxModel()
        mockSendTransaction
            .mockResolvedValueOnce({status: 'ERROR'})
            .mockResolvedValueOnce({status: 'PENDING'})
        mockPollTransaction.mockResolvedValue({status: 'SUCCESS'})

        await expect(submitTransaction(txModel)).resolves.toBe(true)
        expect(mockSendTransaction).toHaveBeenCalledTimes(2)
        expect(consoleErrorSpy.mock.calls[0][1].message).toBe('Unknown tx submission error')
    })

    test('retries the whole round on unknown submission status', async () => {
        const txModel = buildTxModel()
        mockSendTransaction
            .mockResolvedValueOnce({status: 'SOMETHING_NEW'})
            .mockResolvedValueOnce({status: 'PENDING'})
        mockPollTransaction.mockResolvedValue({status: 'SUCCESS'})

        await expect(submitTransaction(txModel)).resolves.toBe(true)
        expect(consoleErrorSpy.mock.calls[0][1].message).toBe('Unknown tx submission status: SOMETHING_NEW')
    })

    test('throws formatted error when the tx fails after polling', async () => {
        const txModel = buildTxModel()
        mockSendTransaction.mockResolvedValue({status: 'PENDING'})
        mockPollTransaction.mockResolvedValue({status: 'FAILED', resultXdr: txResult('txInsufficientBalance')})

        await expect(submitTransaction(txModel)).rejects.toThrow('Tx error: txInsufficientBalance')
    })

    test('throws generic error when the tx is not found after polling', async () => {
        const txModel = buildTxModel()
        mockSendTransaction.mockResolvedValue({status: 'PENDING'})
        mockPollTransaction.mockResolvedValue({status: 'NOT_FOUND'})

        await expect(submitTransaction(txModel)).rejects.toThrow('Failed to submit transaction')
    })
})
