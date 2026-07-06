import config from '../app.config.json'

export default class RabetProvider {
    title = 'Rabet'

    isAvailable() {
        //Rabet is slow to attach its global, give it some time before answering
        return new Promise(resolve => setTimeout(() => resolve(!!window.rabet), 100))
    }

    async signTx({xdr, network}) {
        await window.rabet.connect()
        const result = await window.rabet.sign(xdr, resolveRabetNetwork(network))
        return result.xdr
    }
}

/**
 * Convert network passphrase to Rabet network enum
 * @param {string} passphrase
 * @return {'mainnet'|'testnet'}
 */
function resolveRabetNetwork(passphrase) {
    if (passphrase === config.networks.public.passphrase)
        return 'mainnet'
    if (passphrase === config.networks.testnet.passphrase)
        return 'testnet'
    throw new Error(`Rabet doesn't support the network: ${passphrase}`)
}
