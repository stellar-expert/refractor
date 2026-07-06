export default class FreighterProvider {
    title = 'Freighter'

    async isAvailable() {
        //newer Freighter versions don't inject a window global - ask the extension
        //via the postMessage handshake (2s timeout built into the api)
        await this.init()
        const res = await this.provider.isConnected()
        return !!res?.isConnected
    }

    init() {
        return import(/* webpackChunkName: "freighter-provider" */'@stellar/freighter-api')
            .then(module => {
                this.provider = module
            })
    }

    async signTx({xdr, network}) {
        await this.init()
        const connected = await this.provider.isConnected()
        if (connected.error) {
            console.error(connected.error)
        }
        if (!connected.isConnected)
            throw new Error({msg: `Freighter wallet not connected`})
        await this.provider.requestAccess()
        await this.provider.getAddress()
        return await this.provider.signTransaction(xdr, {networkPassphrase: network})
    }
}