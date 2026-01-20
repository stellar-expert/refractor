import {StellarWalletsKit} from "@creit-tech/stellar-wallets-kit"
import {defaultModules} from '@creit-tech/stellar-wallets-kit/modules/utils'
import {WalletConnectModule} from '@creit-tech/stellar-wallets-kit/modules/wallet-connect'
import {SwkAppDarkTheme, SwkAppLightTheme} from "@creit-tech/stellar-wallets-kit/types"
import config from '../app.config.json'

const theme = document.documentElement.attributes['data-theme'].value

StellarWalletsKit.init({
    theme: (theme === 'night') ? SwkAppDarkTheme : SwkAppLightTheme,
    modules: [
        ...defaultModules(),
        new WalletConnectModule({
            projectId: "f7e12b9f871e5da52e5faa88ff7b5d30",
            metadata: {
                name: "StellarBroker",
                description: "StellarBroker - Multi-source liquidity swap router for Stellar, providing access to AMMs and Stellar DEX",
                icons: ["/img/stellar-broker-logo+text-v1.png"],
                url: location.href
            }
        })
    ]
})

async function connectWallet() {
    return StellarWalletsKit.authModal()
        .then(connect => {
            if (!connect)
                throw Error('Failed to connect wallet')
        })
        .catch(err => {
            notify({type: 'warning', message: err?.message || 'Failed to obtain a transaction signature'})
            throw err
        })
}

export async function delegateTxSigning(xdr, network) {
    await connectWallet()
    //resolve network
    if (config.networks[network]) {
        network = config.networks[network].passphrase
    }
    //request signature
    return await StellarWalletsKit.signTransaction(xdr,  {
        networkPassphrase: network
    })
}