export default class OneKeyProvider {
    title = 'OneKey'

    isAvailable() {
        return !!window.$onekey?.stellar
    }

    async signTx({xdr, network}) {
        await window.$onekey.stellar.getPublicKey()
        const {signedTxXdr} = await window.$onekey.stellar.signTransaction(xdr, {networkPassphrase: network})
        return signedTxXdr
    }
}
