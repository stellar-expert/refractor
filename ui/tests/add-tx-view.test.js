jest.mock('../infrastructure/tx-dispatcher', () => ({apiSubmitTx: jest.fn()}))

import React from 'react'
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {navigation} from '@stellar-expert/ui-framework'
import {apiSubmitTx} from '../infrastructure/tx-dispatcher'
import AddTxView from '../views/tx/add/add-tx-view'
import {deferred} from './helpers/tx-fixtures'

const placeholders = {
    xdr: 'Base64-encoded transaction envelope',
    callback: 'for example, https://my.service/success.php',
    expires: 'UNIX timestamp or ISO date, like 2020-11-29T09:29:13Z'
}

function fillForm({xdr, callback, expires}) {
    if (xdr !== undefined) {
        fireEvent.change(screen.getByPlaceholderText(placeholders.xdr), {target: {value: xdr}})
    }
    if (callback !== undefined) {
        fireEvent.change(screen.getByPlaceholderText(placeholders.callback), {target: {value: callback}})
    }
    if (expires !== undefined) {
        fireEvent.change(screen.getByPlaceholderText(placeholders.expires), {target: {value: expires}})
    }
}

function clickSave() {
    fireEvent.click(screen.getByText('Save'))
}

beforeEach(() => {
    navigation.navigate('/tx/add')
})

test('submits collected parameters and navigates to the stored transaction', async () => {
    apiSubmitTx.mockResolvedValue({hash: 'abc123'})
    render(<AddTxView/>)

    fillForm({xdr: '  AAAA  ', callback: ' https://my.service/cb ', expires: '2030-01-01T00:00:00Z'})
    fireEvent.click(screen.getByLabelText(/Autosubmit to the network/))
    clickSave()

    expect(apiSubmitTx).toHaveBeenCalledWith({
        xdr: 'AAAA',
        network: 'public',
        submit: true,
        callback: 'https://my.service/cb',
        expires: '2030-01-01T00:00:00Z',
        desiredSigners: []
    })
    await waitFor(() => expect(navigation.path).toBe('/tx/abc123'))
})

test('uses public network by default and switches network via dropdown', async () => {
    apiSubmitTx.mockResolvedValue({hash: 'abc123'})
    render(<AddTxView/>)

    fireEvent.click(screen.getByText('public network'))
    fireEvent.click(await screen.findByText('testnet network'))
    fillForm({xdr: 'AAAA'})
    clickSave()

    expect(apiSubmitTx).toHaveBeenCalledWith(expect.objectContaining({network: 'testnet', xdr: 'AAAA'}))
})

test('shows progress indicator while the request is pending', async () => {
    const request = deferred()
    apiSubmitTx.mockReturnValue(request.promise)
    render(<AddTxView/>)

    fillForm({xdr: 'AAAA'})
    clickSave()

    expect(screen.getByText(/In progress/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(placeholders.xdr)).toBeDisabled()
    expect(screen.getByText('Save').closest('button')).toBeDisabled()
    request.resolve({hash: 'abc123'})
    await waitFor(() => expect(navigation.path).toBe('/tx/abc123'))
})

test('reports validation errors and allows resubmission', async () => {
    apiSubmitTx.mockRejectedValueOnce(new Error('Invalid transaction xdr'))
    render(<AddTxView/>)

    fillForm({xdr: 'bad'})
    clickSave()

    await waitFor(() => expect(notify).toHaveBeenCalledWith({type: 'error', message: 'Invalid transaction xdr'}))
    expect(navigation.path).toBe('/tx/add')
    expect(screen.queryByText(/In progress/)).toBeNull()
    expect(screen.getByPlaceholderText(placeholders.xdr)).not.toBeDisabled()

    apiSubmitTx.mockResolvedValueOnce({hash: 'abc123'})
    clickSave()
    expect(apiSubmitTx).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(navigation.path).toBe('/tx/abc123'))
})

test('cancel link leads back to the home page', () => {
    render(<AddTxView/>)
    expect(screen.getByRole('link', {name: 'Cancel'})).toHaveAttribute('href', '/')
})
