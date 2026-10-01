//jsdom has no canvas implementation
jest.mock('qrcode.react', () => ({
    QRCodeCanvas: ({value}) => <canvas data-testid="qr" data-value={value}/>
}))

import React from 'react'
import {act, fireEvent, render, within} from '@testing-library/react'
import {setWcStatus} from '../signer/walletconnect/wc-status'
import {wcMobileWallets} from '../signer/walletconnect/wc-wallets'
import WalletConnectDialog from '../views/tx/details/walletconnect-dialog'

const uri = 'wc:' + 'a'.repeat(64) + '@2?relay-protocol=irn&symKey=' + 'b'.repeat(64) + '&expiryTimestamp=1'
const account = 'GBJBA3HJPU6Q2PYFLOHLHQMJD2BQPVSABURMTNSHOMS6UUP4MWUTZHE2'
const sessionTopic = 'c'.repeat(64)
const lobstr = wcMobileWallets.find(w => w.name === 'LOBSTR')

function dialog() {
    return within(document.querySelector('.dialog'))
}

afterEach(() => {
    act(() => setWcStatus(null))
})

test('renders nothing while no WalletConnect flow is active', () => {
    render(<WalletConnectDialog/>)
    expect(document.querySelector('.dialog')).toBeNull()
})

test('shows status set before the dialog was mounted', () => {
    setWcStatus({stage: 'connecting', cancel: jest.fn()})
    render(<WalletConnectDialog/>)
    expect(dialog().getByText('Connecting…')).toBeInTheDocument()
})

test('shows connection progress', () => {
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({stage: 'connecting', cancel: jest.fn()}))
    expect(dialog().getByText('Connecting…')).toBeInTheDocument()
})

test('shows pairing QR code and generic deep link', () => {
    const cancel = jest.fn()
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({stage: 'pairing', uri, mobileWallet: null, cancel}))
    expect(dialog().getByTestId('qr')).toHaveAttribute('data-value', uri)
    expect(dialog().getByText('Open in wallet')).toHaveAttribute('href', uri)
    expect(dialog().getByTitle('Copy connection link')).toBeInTheDocument()
    fireEvent.click(dialog().getByText('Cancel'))
    expect(cancel).toHaveBeenCalledTimes(1)
})

test('passes pairing URI via deep link of the chosen wallet app', () => {
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({stage: 'pairing', uri, mobileWallet: lobstr, cancel: jest.fn()}))
    expect(dialog().getByTestId('qr')).toHaveAttribute('data-value', uri)
    expect(dialog().getByText('Open in LOBSTR')).toHaveAttribute('href', 'lobstr://wc?uri=' + encodeURIComponent(uri))
})

test('shows connected wallet while waiting for the signature', () => {
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({
        stage: 'requesting',
        wallet: {name: 'Test Wallet', redirect: {native: 'testwallet://'}},
        account,
        cancel: jest.fn()
    }))
    expect(dialog().getByText('Confirm the transaction in Test Wallet')).toBeInTheDocument()
    expect(dialog().getByTitle(account)).toBeInTheDocument()
    expect(dialog().getByText('Open Test Wallet')).toHaveAttribute('href', 'testwallet://')
})

test('links the chosen wallet app to the pending request', () => {
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({
        stage: 'requesting',
        wallet: {name: 'LOBSTR Wallet', redirect: {native: 'lobstr://'}},
        account,
        requestId: 123,
        sessionTopic,
        mobileWallet: lobstr,
        cancel: jest.fn()
    }))
    expect(dialog().getByText('Open LOBSTR Wallet'))
        .toHaveAttribute('href', `lobstr://wc?requestId=123&sessionTopic=${sessionTopic}`)
})

test('omits wallet link when the wallet provides no redirect', () => {
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({stage: 'requesting', wallet: {name: 'Plain Wallet'}, account, cancel: jest.fn()}))
    expect(dialog().getByText('Confirm the transaction in Plain Wallet')).toBeInTheDocument()
    expect(dialog().queryByText(/^Open /)).toBeNull()
})

test('closes when the flow ends', () => {
    render(<WalletConnectDialog/>)
    act(() => setWcStatus({stage: 'pairing', uri, cancel: jest.fn()}))
    expect(document.querySelector('.dialog')).not.toBeNull()
    act(() => setWcStatus(null))
    expect(document.querySelector('.dialog')).toBeNull()
})
