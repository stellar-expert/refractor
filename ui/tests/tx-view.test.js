jest.mock('../infrastructure/tx-dispatcher', () => ({loadTx: jest.fn()}))
//heavy child views are covered by their own test suites
jest.mock('../views/tx/details/tx-details-operations-view', () => ({
    __esModule: true,
    default: () => require('react').createElement('div', {'data-testid': 'operations'})
}))
jest.mock('../views/tx/details/tx-props-view', () => ({
    __esModule: true,
    default: ({txInfo}) => require('react').createElement('div', {'data-testid': 'props'}, txInfo.status)
}))
jest.mock('../views/tx/details/tx-add-signature-view', () => ({
    __esModule: true,
    default: () => require('react').createElement('div', {'data-testid': 'add-signature'})
}))
jest.mock('../views/tx/submit/horizon-submit-tx-view', () => ({
    __esModule: true,
    default: ({txInfo}) => require('react').createElement('div', {'data-testid': 'submit'}, txInfo.submitted ? 'submitted' : 'not submitted')
}))

import React from 'react'
import {render, screen, act, waitFor} from '@testing-library/react'
import {Router, Route, navigation} from '@stellar-expert/ui-framework'
import {loadTx} from '../infrastructure/tx-dispatcher'
import TxView from '../views/tx/tx-view'
import {buildTxInfo, deferred} from './helpers/tx-fixtures'

function renderTxView(hash) {
    navigation.navigate('/tx/' + hash)
    return render(<Router><Route path="/tx/:txhash" component={TxView}/></Router>)
}

function submitState() {
    return screen.getByTestId('submit').textContent
}

function setDocumentHidden(hidden) {
    Object.defineProperty(document, 'hidden', {value: hidden, configurable: true})
}

async function advance(ms) {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })
}

beforeEach(() => {
    //drop queued once-values left by a previous test, not only the recorded calls
    loadTx.mockReset()
    setDocumentHidden(false)
})

afterEach(() => {
    jest.useRealTimers()
})

test('shows loader until the transaction is loaded, then renders all panels', async () => {
    const request = deferred()
    const txInfo = buildTxInfo({submitted: new Date(), status: 'processed'})
    loadTx.mockReturnValue(request.promise)
    renderTxView(txInfo.hash)

    expect(document.querySelector('.loader')).toBeInTheDocument()
    expect(loadTx).toHaveBeenCalledWith(txInfo.hash)
    expect(loadTx).toHaveBeenCalledTimes(1)

    await act(async () => request.resolve(txInfo))

    expect(screen.getByText(txInfo.hash)).toBeInTheDocument()
    expect(screen.getByText(txInfo.xdr)).toBeInTheDocument()
    for (const heading of ['Properties', 'Status']) {
        expect(screen.getByRole('heading', {name: heading})).toBeInTheDocument()
    }
    expect(screen.getByTestId('operations')).toBeInTheDocument()
    expect(screen.getByTestId('props')).toHaveTextContent('processed')
    expect(submitState()).toBe('submitted')
    expect(screen.getByTestId('add-signature')).toBeInTheDocument()
    expect(document.querySelector('.loader')).toBeNull()
})

test('renders signatures status in the panel header', async () => {
    const txInfo = buildTxInfo({submitted: new Date()})
    txInfo.signatures = [{key: txInfo.schema.requirements[0].signers[0].key}]
    loadTx.mockResolvedValue(txInfo)
    renderTxView(txInfo.hash)

    expect(await screen.findByText('1/2 of 2 possible')).toBeInTheDocument()
})

test('polls the transaction status while pending and stops once submitted', async () => {
    jest.useFakeTimers()
    const pending = buildTxInfo()
    const executed = {...pending, submitted: new Date(), status: 'processed'}
    loadTx.mockResolvedValueOnce(pending).mockResolvedValueOnce({...pending}).mockResolvedValue(executed)
    renderTxView(pending.hash)

    await advance(0)
    expect(submitState()).toBe('not submitted')
    expect(loadTx).toHaveBeenCalledTimes(1)

    await advance(4000)
    expect(loadTx).toHaveBeenCalledTimes(2)
    expect(submitState()).toBe('not submitted')

    await advance(4000)
    expect(loadTx).toHaveBeenCalledTimes(3)
    expect(submitState()).toBe('submitted')

    await advance(20000)
    expect(loadTx).toHaveBeenCalledTimes(3)
})

test('stops polling for failed transactions', async () => {
    jest.useFakeTimers()
    const failed = buildTxInfo({status: 'failed'})
    loadTx.mockResolvedValue(failed)
    renderTxView(failed.hash)

    await advance(20000)
    expect(loadTx).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('props')).toHaveTextContent('failed')
})

test('pauses polling while the tab is hidden and resumes on visibility change', async () => {
    jest.useFakeTimers()
    const pending = buildTxInfo()
    loadTx.mockResolvedValue(pending)
    renderTxView(pending.hash)
    await advance(0)
    expect(loadTx).toHaveBeenCalledTimes(1)

    setDocumentHidden(true)
    await advance(12000)
    expect(loadTx).toHaveBeenCalledTimes(1)

    setDocumentHidden(false)
    await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
        await jest.advanceTimersByTimeAsync(0)
    })
    expect(loadTx).toHaveBeenCalledTimes(2)

    //polling continues after resuming
    await advance(4000)
    expect(loadTx).toHaveBeenCalledTimes(3)
})

test('stops polling after unmount', async () => {
    jest.useFakeTimers()
    const pending = buildTxInfo()
    loadTx.mockResolvedValue(pending)
    const {unmount} = renderTxView(pending.hash)
    await advance(0)

    unmount()
    await advance(20000)
    expect(loadTx).toHaveBeenCalledTimes(1)
})

test('notifies about loading errors and keeps the loader', async () => {
    loadTx.mockRejectedValue(new Error('Transaction not found'))
    renderTxView('b'.repeat(64))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({type: 'error', message: 'Transaction not found'}))
    expect(document.querySelector('.loader')).toBeInTheDocument()
})
