export default class LobstrProvider {
    title = 'Lobstr'

    init() {
        return import(/* webpackChunkName: "lobstr-provider" */'@lobstrco/signer-extension-api')
            .then(module => {
                this.provider = module
            })
    }

    async signTx({xdr, network}) {
        await this.init()
        if (!(await this.provider.isConnected()))
            throw new Error(`Lobstr wallet not connected`)
        return await this.provider.signTransaction(xdr)
    }
}