import React from 'react'
import {render, screen} from '@testing-library/react'
import {Keypair} from '@stellar/stellar-sdk'
import {shortenString} from '@stellar-expert/formatter'
import TxSignaturesView from '../views/tx/details/tx-signatures-view'

const [a, b, c] = [Keypair.random().publicKey(), Keypair.random().publicKey(), Keypair.random().publicKey()]
const schema = {
    requirements: [{minThreshold: 2, signers: [{key: a, weight: 1}, {key: b, weight: 2}, {key: c, weight: 1}]}],
    getAllPotentialSigners: () => [a, b, c]
}

function short(key) {
    return shortenString(key, 12)
}

test('lists applied signatures with weights and the remaining available signers', () => {
    render(<TxSignaturesView signatures={[{key: a}]} schema={schema} readyToSubmit={false}/>)

    const applied = screen.getByText(short(a)).closest('div')
    expect(applied).toHaveTextContent('(w: 1)')
    expect(applied.querySelector('.icon-feather')).toBeInTheDocument()

    expect(screen.getByText('Other available signers:')).toBeInTheDocument()
    expect(screen.getByText(short(b)).closest('div')).toHaveTextContent('(w: 2)')
    expect(screen.getByText(short(c))).toBeInTheDocument()
    expect(document.querySelectorAll('.icon-feather')).toHaveLength(1)
    expect(screen.queryByText('(no signatures so far)')).toBeNull()
})

test('shows placeholder and all potential signers when nothing is signed yet', () => {
    render(<TxSignaturesView signatures={[]} schema={schema} readyToSubmit={false}/>)
    expect(screen.getByText('(no signatures so far)')).toBeInTheDocument()
    expect(screen.getByText('Available signers:')).toBeInTheDocument()
    for (const key of [a, b, c]) {
        expect(screen.getByText(short(key))).toBeInTheDocument()
    }
})

test('hides available signers once the transaction is ready to submit', () => {
    render(<TxSignaturesView signatures={[{key: a}, {key: b}]} schema={schema} readyToSubmit={true}/>)
    expect(screen.queryByText(/available signers/i)).toBeNull()
    expect(screen.queryByText(short(c))).toBeNull()
    expect(document.querySelectorAll('.icon-feather')).toHaveLength(2)
})

test('highlights newly accepted signatures and notifies about changes', () => {
    const changes = {
        accepted: [{key: a, signature: 'sig-a'}],
        rejected: [{key: 'G______________________________________________ABCDE____', signature: 'sig-x'}]
    }
    render(<TxSignaturesView signatures={[{key: a}]} schema={schema} readyToSubmit={false} changes={changes}/>)

    expect(screen.getByText(short(a)).closest('div')).toHaveClass('highlighter')
    expect(screen.getByText(short(b)).closest('div')).not.toHaveClass('highlighter')

    expect(notify).toHaveBeenCalledTimes(2)
    const [success, error] = notify.mock.calls.map(call => call[0])
    expect(success.type).toBe('success')
    expect(render(success.message).container).toHaveTextContent(`Signature from ${short(a)} accepted`)
    expect(error.type).toBe('error')
    expect(render(error.message).container).toHaveTextContent('Signature from G...ABCDE... rejected')
})

test('does not notify without changes', () => {
    render(<TxSignaturesView signatures={[{key: a}]} schema={schema} readyToSubmit={false}/>)
    expect(notify).not.toHaveBeenCalled()
})
