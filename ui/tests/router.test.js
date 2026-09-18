jest.mock('../infrastructure/tx-dispatcher', () => ({
    loadTx: jest.fn(() => new Promise(() => {
    })),
    checkTxSubmitted: jest.fn(),
    apiSubmitTx: jest.fn()
}))

import React from 'react'
import {render, screen, act} from '@testing-library/react'
import {navigation, bindClickNavHandler} from '@stellar-expert/ui-framework'
import {loadTx} from '../infrastructure/tx-dispatcher'
import AppRouter from '../views/router'

const hash = 'a'.repeat(64)
const uploadLink = {name: /Upload new transaction/}

function renderApp(path) {
    act(() => navigation.navigate(path))
    return render(<AppRouter history={navigation.history}/>)
}

test('renders the add-transaction view for /tx/add ahead of the hash route', () => {
    renderApp('/tx/add')
    expect(screen.getByRole('heading', {name: 'Store transaction'})).toBeInTheDocument()
    expect(loadTx).not.toHaveBeenCalled()
})

test('renders the transaction view and passes the hash route param', () => {
    renderApp('/tx/' + hash)
    expect(loadTx).toHaveBeenCalledWith(hash)
    expect(document.querySelector('.loader')).toBeInTheDocument()
})

test('falls back to the 404 view for unknown paths', () => {
    renderApp('/some/unknown/page')
    expect(screen.getByText(/PAGE NOT FOUND/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: 'Store transaction'})).toBeNull()
})

test('switches views on client-side navigation without remounting the layout', () => {
    renderApp('/tx/add')
    const layoutLink = screen.getByRole('link', uploadLink)
    act(() => navigation.navigate('/nowhere'))
    expect(screen.getByText(/PAGE NOT FOUND/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name: 'Store transaction'})).toBeNull()
    expect(screen.getByRole('link', uploadLink)).toBe(layoutLink)
    act(() => navigation.navigate('/tx/add'))
    expect(screen.getByRole('heading', {name: 'Store transaction'})).toBeInTheDocument()
})

test('intercepts in-app link clicks through the navigation handler', () => {
    const {container} = renderApp('/tx/' + hash)
    bindClickNavHandler(container)
    act(() => {
        screen.getByRole('link', uploadLink).click()
    })
    expect(navigation.path).toBe('/tx/add')
    expect(screen.getByRole('heading', {name: 'Store transaction'})).toBeInTheDocument()
})
