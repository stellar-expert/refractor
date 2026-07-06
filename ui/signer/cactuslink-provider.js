export default class CactusLinkProvider {
    title = 'CactusLink'

    checkAvailable() {
        return !!window.cactuslink_stellar
    }

    async signTx({xdr, network}) {
        const access = await window.cactuslink_stellar.requestAccess()
        if (access.error)
            throw access.error
        const {address} = await window.cactuslink_stellar.getAddress()
        if (!address)
            throw new Error('Cactus Link did not return an address')
        const {signedTxXdr} = await window.cactuslink_stellar.signTransaction(xdr, {networkPassphrase: network, address})
        return signedTxXdr
    }
}
