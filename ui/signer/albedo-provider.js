export default class AlbedoProvider {
    title = 'Albedo'

    mobileSupported = true

    init() {
        return import(/* webpackChunkName: "albedo-provider" */'@albedo-link/intent')
            .then(module => {
                this.provider = module.default
            })
    }

    async signTx({xdr, network}) {
        await this.init()
        const res = await this.provider.tx({xdr, network})
        return res.signed_envelope_xdr
    }
}