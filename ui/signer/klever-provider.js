export default class KleverProvider {
    title = 'Klever'

    checkAvailable() {
        return !!window.kleverWallet?.stellar
    }

    async signTx({xdr, network}) {
        //ensure the wallet is connected before requesting a signature
        await window.kleverWallet.stellar.getAddress()
        const {signedTxXdr} = await window.kleverWallet.stellar.signTransaction(xdr, {networkPassphrase: network})
        return signedTxXdr
    }
}
