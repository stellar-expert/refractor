//sanity check of the Jest environment wiring (polyfills, webpack-defined globals, framework and SDK loading)
import {Keypair, TransactionBuilder} from '@stellar/stellar-sdk'
import {navigation} from '@stellar-expert/ui-framework'
import {buildTx, testnetPassphrase} from './helpers/tx-fixtures'

test('webpack-defined globals are available', () => {
    expect(apiOrigin).toBe('https://api.refractor.test')
    expect(typeof notify).toBe('function')
})

test('stellar sdk works under jsdom', () => {
    const source = Keypair.random()
    const tx = buildTx({source})
    expect(TransactionBuilder.fromXDR(tx.toXDR(), testnetPassphrase).source).toBe(source.publicKey())
})

test('ui-framework navigation is bound to jsdom history', () => {
    navigation.navigate('/tx/add')
    expect(navigation.path).toBe('/tx/add')
    expect(window.location.pathname).toBe('/tx/add')
})
