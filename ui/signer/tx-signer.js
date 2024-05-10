import config from '../app.config.json'
import AlbedoProvider from './albedo-provider'
import FreighterProvider from './freighter-provider'
import LobstrProvider from './lobstr-provider'
import XBullProvider from './xbull-provider'

const signerProviders = {}
//create instances for all available providers
for (let providerClass of [AlbedoProvider, FreighterProvider, LobstrProvider, XBullProvider]) {
    const provider = new providerClass()
    signerProviders[provider.title] = provider
}

export function getAllProviders() {
    return Object.values(signerProviders)
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
