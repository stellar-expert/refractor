import config from '../app.config.json'
import {getAllProviders, getAvailableProviders, delegateTxSigning} from '../signer/tx-signer'
import {getWcStatus} from '../signer/walletconnect/wc-status'

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
        expect(titles).toEqual(['Albedo', 'Freighter', 'Lobstr', 'xBull', 'Rabet', 'Hana', 'Klever', 'OneKey', 'Bitget', 'CactusLink', 'Fordefi',
            'WalletConnect'])
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
        expect(providers.filter(p => p.mobileSupported).map(p => p.title)).toEqual(['Albedo', 'xBull', 'WalletConnect'])
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

    test('passes provider-specific options to the wallet', async () => {
        const signTx = jest.spyOn(provider('WalletConnect'), 'signTx').mockResolvedValue('SIGNED')
        await delegateTxSigning('WalletConnect', 'TX_XDR', 'public', {wallet: 'LOBSTR'})
        expect(signTx).toHaveBeenCalledWith({xdr: 'TX_XDR', network: config.networks.public.passphrase, wallet: 'LOBSTR'})
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

describe('WalletConnect provider', () => {
    const wc = provider('WalletConnect')
    const configuredProjectId = config.walletConnect.projectId

    afterEach(() => {
        config.walletConnect.projectId = configuredProjectId
    })

    function stubSignClient(signXdr) {
        jest.spyOn(wc, 'init').mockImplementation(async function () {
            this.provider = {signXdr}
        })
    }

    test('is available only when a project id is configured', () => {
        config.walletConnect.projectId = ''
        expect(wc.checkAvailable()).toBe(false)
        config.walletConnect.projectId = 'test-project'
        expect(wc.checkAvailable()).toBe(true)
    })

    test('maps network passphrase to Stellar chain id', async () => {
        config.walletConnect.projectId = 'test-project'
        const signXdr = jest.fn().mockResolvedValue('SIGNED_XDR')
        stubSignClient(signXdr)
        await expect(wc.signTx({xdr: 'TX_XDR', network: config.networks.testnet.passphrase})).resolves.toBe('SIGNED_XDR')
        await wc.signTx({xdr: 'TX_XDR', network: config.networks.public.passphrase})
        expect(signXdr.mock.calls.map(([args]) => args.chainId)).toEqual(['stellar:testnet', 'stellar:pubnet'])
        expect(signXdr.mock.calls[0][0]).toMatchObject({xdr: 'TX_XDR', projectId: 'test-project', metadata: {name: 'Refractor'}})
    })

    test('exposes the chosen mobile wallet app in flow status', async () => {
        let observed
        stubSignClient(async ({onStatus}) => {
            onStatus({stage: 'pairing', uri: 'wc:test'})
            observed = getWcStatus()
            onStatus(null)
            return 'SIGNED'
        })
        await wc.signTx({xdr: 'TX_XDR', network: config.networks.public.passphrase, wallet: 'LOBSTR'})
        expect(observed.mobileWallet).toMatchObject({name: 'LOBSTR', link: 'lobstr://'})
    })

    test('rejects custom networks without loading the client', async () => {
        const init = jest.spyOn(wc, 'init')
        await expect(wc.signTx({xdr: 'TX_XDR', network: 'Custom Network ; 2026'}))
            .rejects.toThrow('WalletConnect supports only Stellar public and testnet networks')
        expect(init).not.toHaveBeenCalled()
    })

    test('publishes flow status with a cancel handler', async () => {
        stubSignClient(({onStatus, signal}) => new Promise((resolve, reject) => {
            onStatus({stage: 'pairing', uri: 'wc:test'})
            signal.addEventListener('abort', () => {
                onStatus(null)
                reject(new Error('Cancelled'))
            })
        }))
        const pending = wc.signTx({xdr: 'TX_XDR', network: config.networks.testnet.passphrase})
        await new Promise(resolve => setTimeout(resolve))
        expect(getWcStatus()).toMatchObject({stage: 'pairing', uri: 'wc:test', mobileWallet: null})
        getWcStatus().cancel()
        await expect(pending).rejects.toThrow('Cancelled')
        expect(getWcStatus()).toBeNull()
    })
})
