const {registerRoute} = require('./router'),
    {loadRehydrateTx} = require('../business-logic/tx-loader'),
    Signer = require('../business-logic/signer')

module.exports = function registerRoutes(app) {
    registerRoute(app,
        'tx/:hash',
        {rate: 'general'},
        ({params}) => loadRehydrateTx(params.hash))

    registerRoute(app,
        '/tx',
        {rate: 'strict', method: 'post'},
        async ({body}) => {
            const signer = new Signer(body)
            await signer.init()
            signer.processNewSignatures()
            await signer.saveChanges()
            return signer.toJSON()
        })

}
