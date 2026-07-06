export default class BitgetProvider {
    title = 'Bitget'

    isAvailable() {
        return !!window.bitkeep?.stellar
    }

    async signTx({xdr, network}) {
        const address = await window.bitkeep.stellar.connect()
        return await window.bitkeep.stellar.signTransaction(xdr, {networkPassphrase: network, address})
    }
}
