import config from '../app.config.json'
import {setWcStatus} from './walletconnect/wc-status'

export default class WalletConnectProvider {
    title = 'WalletConnect'

    mobileSupported = true

    checkAvailable() {
        return !!config.walletConnect?.projectId && typeof WebSocket !== 'undefined'
    }

    init() {
        return import(/* webpackChunkName: "walletconnect-provider" */'./walletconnect/wc-sign-client')
            .then(module => {
                this.provider = module
            })
    }

    async signTx({xdr, network}) {
        const chainId = resolveChainId(network)
        await this.init()
        const controller = new AbortController()
        const {origin} = window.location
        return await this.provider.signXdr({
            xdr,
            chainId,
            projectId: config.walletConnect.projectId,
            relayUrl: config.walletConnect.relayUrl,
            metadata: {
                name: 'Refractor',
                description: 'Pending transactions storage and multisig aggregator for Stellar Network',
                url: origin,
                //PNG rather than SVG - many mobile wallets can't render SVG icons
                icons: [origin + '/img/refractor-small-logo.png']
            },
            onStatus: status => setWcStatus(status && {...status, cancel: () => controller.abort()}),
            signal: controller.signal
        })
    }
}

function resolveChainId(passphrase) {
    switch (passphrase) {
        case config.networks.public.passphrase:
            return 'stellar:pubnet'
        case config.networks.testnet.passphrase:
            return 'stellar:testnet'
    }
    throw new Error('WalletConnect supports only Stellar public and testnet networks')
}
