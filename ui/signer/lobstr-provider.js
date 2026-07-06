export default class LobstrProvider {
    title = 'Lobstr'

    async isAvailable() {
        //newer Lobstr versions don't inject a window global - ask the extension
        //via the postMessage handshake (2s timeout built into the api)
        await this.init()
        return await this.provider.isConnected()
    }

    init() {
        return import(/* webpackChunkName: "lobstr-provider" */'@lobstrco/signer-extension-api')
            .then(module => {
                this.provider = module
            })
    }

    async signTx({xdr, network}) {
        await this.init()
        if (!(await this.provider.isConnected()))
            throw new Error({msg: `Lobstr wallet not connected`})
        await this.provider.getPublicKey()
        return await this.provider.signTransaction(xdr)
    }
}