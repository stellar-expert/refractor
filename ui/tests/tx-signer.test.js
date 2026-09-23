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
        expect(providers.filter(p => p.mobileSupported).map(p => p.title)).toEqual(['Albedo'])
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

describe('Freighter provider', () => {
    //@stellar/freighter-api v3+ resolves signTransaction to an object, not an XDR string
    function stubFreighterApi(signResult) {
        const freighter = provider('Freighter')
        const api = {
            isConnected: jest.fn().mockResolvedValue({isConnected: true}),
            requestAccess: jest.fn().mockResolvedValue({address: 'GSIGNER'}),
            getAddress: jest.fn().mockResolvedValue({address: 'GSIGNER'}),
            signTransaction: jest.fn().mockResolvedValue(signResult)
        }
        jest.spyOn(freighter, 'init').mockImplementation(async function () {
            this.provider = api
        })
        return {freighter, api}
    }

    test('returns the signed XDR string from the freighter-api result object', async () => {
        const {freighter, api} = stubFreighterApi({signedTxXdr: 'SIGNED_XDR', signerAddress: 'GSIGNER'})
        await expect(freighter.signTx({xdr: 'TX_XDR', network: 'Test SDF Network ; September 2015'}))
            .resolves.toBe('SIGNED_XDR')
        expect(api.signTransaction).toHaveBeenCalledWith('TX_XDR', {networkPassphrase: 'Test SDF Network ; September 2015'})
    })

    test('rejects with the wallet message when Freighter reports an error', async () => {
        const {freighter} = stubFreighterApi({signedTxXdr: '', signerAddress: '', error: {message: 'User declined access'}})
        await expect(freighter.signTx({xdr: 'TX_XDR', network: 'Test SDF Network ; September 2015'}))
            .rejects.toThrow('User declined access')
    })
})
