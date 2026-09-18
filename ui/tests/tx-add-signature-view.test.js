jest.mock('../signer/tx-signer', () => ({
    getAllProviders: jest.fn(() => [{title: 'Albedo', mobileSupported: true}, {title: 'Freighter'}]),
    getAvailableProviders: jest.fn(),
    delegateTxSigning: jest.fn()
}))
jest.mock('../infrastructure/tx-dispatcher', () => ({apiSubmitTx: jest.fn()}))

import React from 'react'
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react'
import {getAvailableProviders, delegateTxSigning} from '../signer/tx-signer'
import {apiSubmitTx} from '../infrastructure/tx-dispatcher'
import TxAddSignatureView from '../views/tx/details/tx-add-signature-view'
import {buildTxInfo, deferred} from './helpers/tx-fixtures'

const detectedProviders = [
    {title: 'Freighter', available: false},
    {title: 'Albedo', available: true}
]
const importPlaceholder = /Copy-paste base64-encoded transaction XDR/

function desktop() {
    return within(document.querySelector('.desktop-only'))
}

function mobile() {
    return within(document.querySelector('.mobile-only'))
}

function dialog() {
    return within(document.querySelector('.dialog'))
}

function dropdownOptions() {
    return [...document.querySelectorAll('.dd-list-item')]
}

async function renderView(txInfo = buildTxInfo(), onUpdate = jest.fn()) {
    render(<TxAddSignatureView txInfo={txInfo} onUpdate={onUpdate}/>)
    //wait for the wallet detection to complete
    await waitFor(() => expect(desktop().getByText('Sign').closest('button')).not.toBeDisabled())
    return {txInfo, onUpdate}
}

beforeEach(() => {
    getAvailableProviders.mockResolvedValue(detectedProviders)
    jest.spyOn(console, 'error').mockImplementation(() => {
    })
})

afterEach(() => {
    jest.restoreAllMocks()
})

test('renders nothing for fully signed or submitted transactions', () => {
    const {container, rerender} = render(<TxAddSignatureView txInfo={buildTxInfo({readyToSubmit: true})} onUpdate={jest.fn()}/>)
    expect(container).toHaveTextContent('')
    expect(screen.queryByText('Sign')).toBeNull()
    rerender(<TxAddSignatureView txInfo={buildTxInfo({submitted: new Date()})} onUpdate={jest.fn()}/>)
    expect(screen.queryByText('Sign')).toBeNull()
})

test('keeps signing disabled until wallet detection completes', async () => {
    const detection = deferred()
    getAvailableProviders.mockReturnValue(detection.promise)
    render(<TxAddSignatureView txInfo={buildTxInfo()} onUpdate={jest.fn()}/>)

    expect(desktop().getByText('Sign').closest('button')).toBeDisabled()
    detection.resolve(detectedProviders)
    await waitFor(() => expect(desktop().getByText('Sign').closest('button')).not.toBeDisabled())
})

test('lists detected wallets with available ones first and unavailable ones disabled', async () => {
    await renderView()
    fireEvent.click(desktop().getByText('Sign'))

    const options = dropdownOptions()
    expect(options.map(o => o.textContent.replace(/\s+/g, ' ').trim())).toEqual(['Albedo', 'Freighter (not connected)'])

    fireEvent.click(within(options[1]).getByText('Freighter'))
    expect(delegateTxSigning).not.toHaveBeenCalled()
})

test('signs with the selected wallet and stores the signature', async () => {
    const {txInfo, onUpdate} = await renderView()
    const updated = {...txInfo, signatures: [{key: 'GSIGNER'}]}
    delegateTxSigning.mockResolvedValue('SIGNED_XDR')
    apiSubmitTx.mockResolvedValue(updated)

    fireEvent.click(desktop().getByText('Sign'))
    fireEvent.click(within(dropdownOptions()[0]).getByText('Albedo'))

    expect(delegateTxSigning).toHaveBeenCalledWith('Albedo', txInfo.xdr, txInfo.network)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated))
    expect(apiSubmitTx).toHaveBeenCalledWith({...txInfo, xdr: 'SIGNED_XDR'})
})

test('mobile wallet buttons request signature from the corresponding provider', async () => {
    const {txInfo, onUpdate} = await renderView()
    delegateTxSigning.mockResolvedValue('SIGNED_XDR')
    apiSubmitTx.mockResolvedValue(txInfo)

    fireEvent.click(mobile().getByText('Albedo'))

    expect(delegateTxSigning).toHaveBeenCalledWith('Albedo', txInfo.xdr, txInfo.network)
    await waitFor(() => expect(onUpdate).toHaveBeenCalled())
})

test('shows a warning when the wallet refuses to sign', async () => {
    const {onUpdate} = await renderView()
    delegateTxSigning.mockRejectedValue({msg: 'User declined the request'})

    fireEvent.click(mobile().getByText('Albedo'))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({type: 'warning', message: 'User declined the request'}))
    expect(apiSubmitTx).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(document.querySelector('.loader')).toBeNull()
})

test('falls back to a generic warning when the wallet error has no message', async () => {
    await renderView()
    delegateTxSigning.mockRejectedValue(undefined)

    fireEvent.click(mobile().getByText('Albedo'))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({type: 'warning', message: 'Failed to obtain a transaction signature'}))
})

test('shows an error when storing the signature fails', async () => {
    const {onUpdate} = await renderView()
    delegateTxSigning.mockResolvedValue('SIGNED_XDR')
    apiSubmitTx.mockRejectedValue(new Error('Bad Request'))

    fireEvent.click(mobile().getByText('Albedo'))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({
        type: 'error',
        message: 'Failed to store transaction signature. Please repeat the process later.'
    }))
    expect(onUpdate).not.toHaveBeenCalled()
})

test('imports signatures from pasted transaction XDR', async () => {
    const {txInfo, onUpdate} = await renderView()
    const updated = {...txInfo, signatures: [{key: 'GSIGNER'}]}
    apiSubmitTx.mockResolvedValue(updated)

    expect(screen.queryByPlaceholderText(importPlaceholder)).toBeNull()
    fireEvent.click(desktop().getByText('Import'))
    fireEvent.change(screen.getByPlaceholderText(importPlaceholder), {target: {value: '  SIGNED_XDR  '}})
    fireEvent.click(dialog().getByText('Import'))

    expect(apiSubmitTx).toHaveBeenCalledWith({network: txInfo.network, xdr: 'SIGNED_XDR'})
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated))
    expect(screen.queryByPlaceholderText(importPlaceholder)).toBeNull()
})

test('keeps the import dialog open and reports the error when import fails', async () => {
    const {onUpdate} = await renderView()
    apiSubmitTx.mockRejectedValue(new Error('Invalid transaction xdr'))

    fireEvent.click(desktop().getByText('Import'))
    fireEvent.change(screen.getByPlaceholderText(importPlaceholder), {target: {value: 'bad'}})
    fireEvent.click(dialog().getByText('Import'))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({type: 'error', message: 'Invalid transaction xdr'}))
    expect(screen.getByPlaceholderText(importPlaceholder)).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.click(dialog().getByText('Cancel'))
    expect(screen.queryByPlaceholderText(importPlaceholder)).toBeNull()
})
