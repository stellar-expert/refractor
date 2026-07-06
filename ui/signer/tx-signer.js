import config from '../app.config.json'
import AlbedoProvider from './albedo-provider'
import FreighterProvider from './freighter-provider'
import LobstrProvider from './lobstr-provider'
import XBullProvider from './xbull-provider'
import RabetProvider from './rabet-provider'
import HanaProvider from './hana-provider'
import KleverProvider from './klever-provider'
import OneKeyProvider from './onekey-provider'
import BitgetProvider from './bitget-provider'
import CactusLinkProvider from './cactuslink-provider'
import FordefiProvider from './fordefi-provider'

const signerProviders = {}
//create instances for all available providers
for (let providerClass of [AlbedoProvider, FreighterProvider, LobstrProvider, XBullProvider, RabetProvider,
    HanaProvider, KleverProvider, OneKeyProvider, BitgetProvider, CactusLinkProvider, FordefiProvider]) {
    const provider = new providerClass()
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
