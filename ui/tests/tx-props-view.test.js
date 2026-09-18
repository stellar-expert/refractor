//AccountAddress resolves directory names via the explorer API - replace it with a plain renderer
jest.mock('@stellar-expert/ui-framework', () => ({
    ...jest.requireActual('@stellar-expert/ui-framework'),
    AccountAddress: ({account}) => require('react').createElement('span', {'data-testid': 'address'}, account)
}))

import React from 'react'
import {render, screen} from '@testing-library/react'
import {Keypair, Memo, TransactionBuilder} from '@stellar/stellar-sdk'
import {formatDateUTC} from '@stellar-expert/formatter'
import TxPropsView from '../views/tx/details/tx-props-view'
import {buildTx, txHash, testnetPassphrase} from './helpers/tx-fixtures'

function txInfoFor(tx, overrides = {}) {
    return {hash: txHash(tx), network: 'testnet', xdr: tx.toXDR(), status: 'pending', signatures: [], ...overrides}
}

function row(label) {
    return screen.getByText(label).closest('div')
}

test('renders core transaction properties', () => {
    const source = Keypair.random()
    const tx = buildTx({source, memo: Memo.text('hello refractor')})
    render(<TxPropsView txInfo={txInfoFor(tx)}/>)

    expect(row('Network:')).toHaveTextContent('testnet')
    expect(row('State:')).toHaveTextContent('Waiting for signatures')
    expect(row('Source account:')).toHaveTextContent(source.publicKey())
    expect(row('Source sequence:')).toHaveTextContent('101')
    expect(row('Memo:')).toHaveTextContent('hello refractor')
    expect(row('Memo:')).toHaveTextContent('(MEMO_TEXT)')
    expect(screen.queryByText(/Autosubmit/)).toBeNull()
    expect(screen.queryByText(/Callback URL/)).toBeNull()
    expect(screen.queryByText(/Expiration/)).toBeNull()
    expect(screen.queryByText(/Fee sponsor/)).toBeNull()
})

test('renders optional storage parameters', () => {
    const tx = buildTx()
    const maxTime = 1900000000
    render(<TxPropsView txInfo={txInfoFor(tx, {submit: true, callbackUrl: 'https://my.service/cb', maxTime})}/>)

    expect(row('Autosubmit:')).toHaveTextContent('yes')
    expect(row('Callback URL:')).toHaveTextContent('https://my.service/cb')
    expect(row('Expiration:')).toHaveTextContent(formatDateUTC(maxTime))
})

test('omits memo row for transactions without memo', () => {
    render(<TxPropsView txInfo={txInfoFor(buildTx())}/>)
    expect(screen.queryByText('Memo:')).toBeNull()
})

test('renders binary memo in base64', () => {
    const hash = Buffer.alloc(32, 7)
    const tx = buildTx({memo: Memo.hash(hash)})
    render(<TxPropsView txInfo={txInfoFor(tx)}/>)
    expect(row('Memo:')).toHaveTextContent(hash.toString('base64'))
    expect(row('Memo:')).toHaveTextContent('(MEMO_HASH)')
})

test('unwraps fee bump transactions and shows the fee sponsor', () => {
    const source = Keypair.random()
    const sponsor = Keypair.random()
    const inner = buildTx({source, sign: true})
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(sponsor, '200', inner, testnetPassphrase)
    render(<TxPropsView txInfo={txInfoFor(feeBump)}/>)

    expect(row('Fee sponsor:')).toHaveTextContent(sponsor.publicKey())
    expect(row('Source account:')).toHaveTextContent(source.publicKey())
    expect(row('Source sequence:')).toHaveTextContent('101')
})

test('renders time and ledger preconditions', () => {
    const maxTime = 1900000000
    const tx = buildTx({timebounds: {minTime: 0, maxTime}, ledgerbounds: {minLedger: 0, maxLedger: 999999}})
    render(<TxPropsView txInfo={txInfoFor(tx)}/>)

    expect(screen.getByText('Valid before').parentElement).toHaveTextContent('2030-03-17 17:46:40')
    expect(screen.getByText('Valid before ledger').parentElement).toHaveTextContent('999999')
})

test('renders executed transaction state with timestamp', () => {
    const tx = buildTx()
    const submitted = new Date('2026-05-06T07:08:09Z')
    render(<TxPropsView txInfo={txInfoFor(tx, {status: 'processed', submitted})}/>)

    expect(row('State:')).toHaveTextContent('Executed')
    expect(screen.getByTitle('View in explorer')).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/tx/${txHash(tx)}`)
    expect(screen.getByText('Timestamp:')).toBeInTheDocument()
})
