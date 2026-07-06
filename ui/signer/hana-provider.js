export default class HanaProvider {
    title = 'Hana'

    isAvailable() {
        return !!window.hanaWallet?.stellar
    }

    async signTx({xdr, network}) {
        const address = await window.hanaWallet.stellar.getPublicKey()
        return await window.hanaWallet.stellar.signTransaction({
            xdr,
            accountToSign: address,
            networkPassphrase: network
        })
    }
}
