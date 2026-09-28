import config from '../app.config.json'
import {getAllProviders, getAvailableProviders, delegateTxSigning} from '../signer/tx-signer'

const providers = getAllProviders()

function provider(title) {
    return providers.find(p => p.title === title)
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe('provider registry', () => {
    test('registers every supported wallet exactly once', () => {
        const titles = providers.map(p => p.title)
        expect(titles).toEqual(['Albedo', 'Freighter', 'Lobstr', 'xBull', 'Rabet', 'Hana', 'Klever', 'OneKey', 'Bitget', 'CactusLink', 'Fordefi'])
        expect(new Set(titles).size).toBe(titles.length)
    })

    test('every provider implements the signer interface', () => {
        for (const p of providers) {
            expect(typeof p.title).toBe('string')
            expect(typeof p.checkAvailable).toBe('function')
            expect(typeof p.signTx).toBe('function')
        }
    })

    test('only web-based wallets are marked as mobile-supported', () => {
        expect(providers.filter(p => p.mobileSupported).map(p => p.title)).toEqual(['Albedo', 'xBull'])
    })

    test('browser-extension wallets report unavailable when their globals are missing', async () => {
        for (const title of ['Hana', 'Klever', 'OneKey', 'Bitget', 'CactusLink', 'Fordefi']) {
            expect(await provider(title).checkAvailable()).toBe(false)
        }
    })
})

describe('getAvailableProviders', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.spyOn(console, 'error').mockImplementation(() => {
        })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    function stubDetection(stubs) {
        for (const p of providers) {
            jest.spyOn(p, 'checkAvailable').mockImplementation(stubs[p.title] || (() => false))
        }
    }

    test('marks unresponsive and failing wallets as unavailable while keeping the others', async () => {
        stubDetection({
            Albedo: () => true,
            xBull: () => Promise.resolve(true),
            Freighter: () => Promise.resolve(false),
            Lobstr: () => new Promise(() => {
            }), //never responds
            Rabet: () => {
                throw new Error('extension crashed')
            },
            Hana: () => Promise.reject(new Error('async failure'))
        })
        const pending = getAvailableProviders()
        await jest.advanceTimersByTimeAsync(1000)
        const result = await pending

        expect(result).toHaveLength(providers.length)
        const availability = Object.fromEntries(result.map(p => [p.title, p.available]))
        expect(availability).toMatchObject({
            Albedo: true,
            xBull: true,
            Freighter: false,
            Lobstr: false,
            Rabet: false,
            Hana: false,
            Klever: false
        })
        expect(console.error).toHaveBeenCalledTimes(2)
    })

    test('resolves immediately when all wallets respond before the timeout', async () => {
        stubDetection({Albedo: () => Promise.resolve(true)})
        const result = await getAvailableProviders()
        expect(result.map(p => p.available)).toEqual(providers.map(p => p.title === 'Albedo'))
        expect(jest.getTimerCount()).toBe(0) //detection timeouts cleared
    })
})

describe('delegateTxSigning', () => {
    test('resolves network name to passphrase before calling the wallet', async () => {
        const signTx = jest.spyOn(provider('Albedo'), 'signTx').mockResolvedValue('SIGNED_XDR')
        await expect(delegateTxSigning('Albedo', 'TX_XDR', 'testnet')).resolves.toBe('SIGNED_XDR')
        expect(signTx).toHaveBeenCalledWith({xdr: 'TX_XDR', network: config.networks.testnet.passphrase})
    })

    test('passes custom network passphrase through unchanged', async () => {
        const signTx = jest.spyOn(provider('Freighter'), 'signTx').mockResolvedValue('SIGNED')
        await delegateTxSigning('Freighter', 'TX_XDR', 'Custom Network ; 2026')
        expect(signTx).toHaveBeenCalledWith({xdr: 'TX_XDR', network: 'Custom Network ; 2026'})
    })

    test('propagates wallet errors', async () => {
        jest.spyOn(provider('Albedo'), 'signTx').mockRejectedValue(new Error('User declined'))
        await expect(delegateTxSigning('Albedo', 'TX_XDR', 'public')).rejects.toThrow('User declined')
    })

    test('rejects for unknown provider', async () => {
        await expect(delegateTxSigning('Unknown', 'TX_XDR', 'public')).rejects.toThrow()
    })
})

describe('kit module wrapper', () => {
    const network = 'Test SDF Network ; September 2015'

    //replace the lazy module loader with a stub so no real wallet SDK is pulled in
    function stubModule(title, signTransaction) {
        const p = provider(title)
        const getAddress = jest.fn().mockResolvedValue({address: 'GSIGNER'})
        jest.spyOn(p, 'init').mockResolvedValue({signTransaction, getAddress})
        return Object.assign(p, {stubbedGetAddress: getAddress})
    }

    test('unwraps the signed XDR from the kit module result', async () => {
        const signTransaction = jest.fn().mockResolvedValue({signedTxXdr: 'SIGNED_XDR', signerAddress: 'GSIGNER'})
        await expect(stubModule('Freighter', signTransaction).signTx({xdr: 'TX_XDR', network}))
            .resolves.toBe('SIGNED_XDR')
        expect(signTransaction).toHaveBeenCalledWith('TX_XDR', {address: 'GSIGNER', networkPassphrase: network})
    })

    test('propagates the error reported by the wallet', async () => {
        const signTransaction = jest.fn().mockRejectedValue(new Error('User declined access'))
        await expect(stubModule('Lobstr', signTransaction).signTx({xdr: 'TX_XDR', network}))
            .rejects.toThrow('User declined access')
    })

    test('fails loudly when the wallet returns no signature', async () => {
        const signTransaction = jest.fn().mockResolvedValue({signedTxXdr: ''})
        await expect(stubModule('Rabet', signTransaction).signTx({xdr: 'TX_XDR', network}))
            .rejects.toThrow('Rabet did not sign the transaction')
    })

    test('connects before signing so the wallet issues a session key', async () => {
        const p = stubModule('Lobstr', jest.fn().mockResolvedValue({signedTxXdr: 'SIGNED_XDR'}))
        await p.signTx({xdr: 'TX_XDR', network})
        expect(p.stubbedGetAddress).toHaveBeenCalled()
    })

    test('skips the connect step for Albedo, which selects the account while signing', async () => {
        const p = stubModule('Albedo', jest.fn().mockResolvedValue({signedTxXdr: 'SIGNED_XDR'}))
        await p.signTx({xdr: 'TX_XDR', network})
        expect(p.stubbedGetAddress).not.toHaveBeenCalled()
    })

    test('loads the wallet module only once across repeated calls', async () => {
        const p = provider('Hana')
        const load = jest.spyOn(p, 'load').mockResolvedValue({isAvailable: async () => true})
        p.modulePromise = null
        await Promise.all([p.checkAvailable(), p.checkAvailable()])
        expect(load).toHaveBeenCalledTimes(1)
    })
})
