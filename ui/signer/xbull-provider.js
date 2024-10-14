export default class XBullProvider {
    title = 'xBull'

    init() {
        return import(/* webpackChunkName: "xbull-provider" */'@creit-tech/xbull-wallet-connect')
            .then(module => {
                this.provider = module.xBullWalletConnect
            })
    }

    async signTx({xdr, network}) {
        await this.init()
        const bridge = new this.provider()
        const publicKey = await bridge.connect()
        const res = await bridge.sign({xdr, publicKey, network})
        bridge.closeConnections()
        return res
    }
}