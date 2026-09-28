import config from '../app.config.json'

/**
 * Signer provider backed by a StellarWalletsKit module, loaded on demand.
 */
class KitProvider {
    /**
     * @param {object} params
     * @param {string} params.title - Wallet name shown in the UI (also resolves its icon)
     * @param {function} params.load - Lazy module loader
     * @param {boolean} [params.mobileSupported] - Whether the wallet works on mobile devices
     * @param {boolean} [params.alwaysAvailable] - Web-based wallets that need no availability probing
     * @param {boolean} [params.requiresConnect] - Whether the wallet requires a connect call before signing
     */
    constructor({title, load, mobileSupported = false, alwaysAvailable = false, requiresConnect = true}) {
        this.title = title
        this.load = load
        this.mobileSupported = mobileSupported
        this.alwaysAvailable = alwaysAvailable
        this.requiresConnect = requiresConnect
    }

    /**
     * Pending or resolved module loader promise, shared by every caller
     * @type {Promise<object>}
     * @private
     */
    modulePromise = null

    init() {
        if (!this.modulePromise) {
            this.modulePromise = this.load()
        }
        return this.modulePromise
    }

    async checkAvailable() {
        //web-based wallets work everywhere
        if (this.alwaysAvailable)
            return true
        const module = await this.init()
        return await module.isAvailable()
    }

    async signTx({xdr, network}) {
        const module = await this.init()
        //connect yields the connection key and the signing account
        const address = this.requiresConnect ? (await module.getAddress()).address : undefined
        const {signedTxXdr} = await module.signTransaction(xdr, {address, networkPassphrase: network})
        if (!signedTxXdr)
            throw new Error(`${this.title} did not sign the transaction`)
        return signedTxXdr
    }
}

const signerProviders = {}
//wallets with their own SDK get a dedicated chunk, injected-provider wallets share one
for (const provider of [
    new KitProvider({
        title: 'Albedo',
        mobileSupported: true,
        alwaysAvailable: true,
        //Albedo selects the account inside its own signing popup
        requiresConnect: false,
        load: () => import(/* webpackChunkName: "albedo-provider" */'@creit.tech/stellar-wallets-kit/modules/albedo')
            .then(({AlbedoModule}) => new AlbedoModule())
    }),
    new KitProvider({
        title: 'Freighter',
        load: () => import(/* webpackChunkName: "freighter-provider" */'@creit.tech/stellar-wallets-kit/modules/freighter')
            .then(({FreighterModule}) => new FreighterModule())
    }),
    new KitProvider({
        title: 'Lobstr',
        load: () => import(/* webpackChunkName: "lobstr-provider" */'@creit.tech/stellar-wallets-kit/modules/lobstr')
            .then(({LobstrModule}) => new LobstrModule())
    }),
    new KitProvider({
        title: 'xBull',
        mobileSupported: true,
        alwaysAvailable: true,
        load: () => import(/* webpackChunkName: "xbull-provider" */'@creit.tech/stellar-wallets-kit/modules/xbull')
            .then(({xBullModule}) => new xBullModule())
    }),
    new KitProvider({
        title: 'Rabet',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/rabet')
            .then(({RabetModule}) => new RabetModule())
    }),
    new KitProvider({
        title: 'Hana',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/hana')
            .then(({HanaModule}) => new HanaModule())
    }),
    new KitProvider({
        title: 'Klever',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/klever')
            .then(({KleverModule}) => new KleverModule())
    }),
    new KitProvider({
        title: 'OneKey',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/onekey')
            .then(({OneKeyModule}) => new OneKeyModule())
    }),
    new KitProvider({
        title: 'Bitget',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/bitget')
            .then(({BitgetModule}) => new BitgetModule())
    }),
    new KitProvider({
        title: 'CactusLink',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/cactuslink')
            .then(({CactusLinkModule}) => new CactusLinkModule())
    }),
    new KitProvider({
        title: 'Fordefi',
        load: () => import(/* webpackChunkName: "injected-wallets" */'@creit.tech/stellar-wallets-kit/modules/fordefi')
            .then(({FordefiModule}) => new FordefiModule())
    })
]) {
    signerProviders[provider.title] = provider
}

export function getAllProviders() {
    return Object.values(signerProviders)
}

//treat a wallet as unavailable if it doesn't respond within this time
const detectionTimeout = 1000

/**
 * Detect signer providers available in the current browser
 * @return {Promise<object[]>}
 */
export async function getAvailableProviders() {
    const available = await Promise.all(getAllProviders().map(async provider => {
        let timer
        try {
            const detection = Promise.resolve(provider.checkAvailable())
            const timeout = new Promise(resolve => {
                timer = setTimeout(() => resolve(false), detectionTimeout)
            })
            provider.available = (await Promise.race([detection, timeout]))
            return provider
        } catch (e) {
            console.error(e)
            provider.available = false
            return provider
        } finally {
            clearTimeout(timer)
        }
    }))
    return available.filter(Boolean)
}

export async function delegateTxSigning(providerName, xdr, network) {
    const provider = signerProviders[providerName]
    //resolve network
    if (config.networks[network]) {
        network = config.networks[network].passphrase
    }
    //request signature
    return await provider.signTx({xdr, network})
}
