const mockSubmitTransaction = jest.fn()

jest.mock('@stellar/stellar-sdk', () => {
    const actual = jest.requireActual('@stellar/stellar-sdk')

    class Server {
        constructor(url) {
            this.url = url
        }

        submitTransaction(tx) {
            return mockSubmitTransaction(this.url, tx)
        }
    }

    return {...actual, Horizon: {...actual.Horizon, Server}}
})
jest.mock('../infrastructure/tx-dispatcher', () => ({checkTxSubmitted: jest.fn(), loadTx: jest.fn()}))

import React from 'react'
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import config from '../app.config.json'
import {checkTxSubmitted, loadTx} from '../infrastructure/tx-dispatcher'
import HorizonSubmitTxView from '../views/tx/submit/horizon-submit-tx-view'
import {buildTxInfo} from './helpers/tx-fixtures'

beforeEach(() => {
    checkTxSubmitted.mockResolvedValue({submitted: false})
})

test('shows explorer link for executed transactions', () => {
    const txInfo = buildTxInfo({submitted: new Date(), status: 'processed'})
    render(<HorizonSubmitTxView txInfo={txInfo} onUpdate={jest.fn()}/>)
    expect(screen.getByText(/Transaction has been/)).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'executed'})).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/tx/${txInfo.hash}`)
    expect(checkTxSubmitted).not.toHaveBeenCalled()
})

test('shows processing error', () => {
    render(<HorizonSubmitTxView txInfo={buildTxInfo({status: 'failed', error: 'Tx error: txBadSeq'})} onUpdate={jest.fn()}/>)
    expect(screen.getByText('Tx error: txBadSeq')).toBeInTheDocument()
})

test('explains that more signatures are required for partially signed transactions', () => {
    render(<HorizonSubmitTxView txInfo={buildTxInfo()} onUpdate={jest.fn()}/>)
    expect(screen.getByText(/not fully signed yet/)).toBeInTheDocument()
    expect(screen.queryByText('Submit')).toBeNull()
})

test('does not offer manual submission for auto-submit transactions', () => {
    render(<HorizonSubmitTxView txInfo={buildTxInfo({readyToSubmit: true, submit: true, status: 'ready'})} onUpdate={jest.fn()}/>)
    expect(screen.getByText(/will be submitted automatically/)).toBeInTheDocument()
    expect(screen.queryByText('Submit')).toBeNull()
    expect(checkTxSubmitted).not.toHaveBeenCalled()
})

test('reports processed transactions that were confirmed on the ledger', async () => {
    checkTxSubmitted.mockResolvedValue({submitted: new Date()})
    render(<HorizonSubmitTxView txInfo={buildTxInfo({readyToSubmit: true, status: 'processed'})} onUpdate={jest.fn()}/>)
    expect(await screen.findByText(/fully signed and processed/)).toBeInTheDocument()
    expect(screen.queryByText('Submit')).toBeNull()
})

test('submits fully signed transaction to Horizon and reloads it', async () => {
    const txInfo = buildTxInfo({readyToSubmit: true, status: 'ready'})
    const onUpdate = jest.fn()
    const reloaded = {...txInfo, submitted: new Date(), status: 'processed'}
    mockSubmitTransaction.mockResolvedValue({successful: true})
    loadTx.mockResolvedValue(reloaded)
    render(<HorizonSubmitTxView txInfo={txInfo} onUpdate={onUpdate}/>)

    const submit = await screen.findByText('Submit')
    expect(checkTxSubmitted).toHaveBeenCalledWith(txInfo)
    fireEvent.click(submit)

    expect(mockSubmitTransaction).toHaveBeenCalledTimes(1)
    const [horizonUrl, tx] = mockSubmitTransaction.mock.calls[0]
    expect(horizonUrl).toBe(config.networks.testnet.horizon)
    expect(Buffer.from(tx.hash()).toString('hex')).toBe(txInfo.hash)
    expect(document.querySelector('.loader')).toBeInTheDocument()

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(reloaded))
    expect(loadTx).toHaveBeenCalledWith(txInfo.hash)
})

test('shows Horizon error details when submission is rejected', async () => {
    const txInfo = buildTxInfo({readyToSubmit: true, status: 'ready'})
    const onUpdate = jest.fn()
    mockSubmitTransaction.mockRejectedValue({
        response: {
            data: {
                status: 400,
                title: 'Transaction Failed',
                extras: {result_codes: {transaction: 'tx_failed', operations: ['op_underfunded']}}
            }
        }
    })
    render(<HorizonSubmitTxView txInfo={txInfo} onUpdate={onUpdate}/>)

    fireEvent.click(await screen.findByText('Submit'))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({
        type: 'error',
        message: 'Transaction Failed. Insufficient balance to execute this operation'
    }))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(await screen.findByText('Submit')).toBeInTheDocument()
})

test('hides the submit button when the transaction already exists on the ledger', async () => {
    checkTxSubmitted.mockResolvedValue({submitted: new Date()})
    render(<HorizonSubmitTxView txInfo={buildTxInfo({readyToSubmit: true, status: 'ready'})} onUpdate={jest.fn()}/>)
    await waitFor(() => expect(checkTxSubmitted).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Submit')).toBeNull())
    expect(screen.queryByText(/fully signed and ready/)).toBeNull()
})
