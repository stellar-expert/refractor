export default class FreighterProvider {
    title = 'Freighter'

    init() {
        return import(/* webpackChunkName: "freighter-provider" */'@stellar/freighter-api')
            .then(module => {
                this.provider = module
            })
    }

    async signTx({xdr, network}) {
        await this.init()
        if (!(await this.provider.isConnected()))
            throw new Error(`Freighter wallet not connected`)
        return await this.provider.signTransaction(xdr, {networkPassphrase: network})
    }
}