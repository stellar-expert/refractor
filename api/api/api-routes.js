const {registerRoute} = require('./router'),
    {loadRehydrateTx} = require('../business-logic/tx-loader'),
    Signer = require('../business-logic/signer'),
    {serviceInfo} = require('../business-logic/info-handler')

module.exports = function registerRoutes(app) {
    registerRoute(app,
        '/',
        {},
        () => serviceInfo())

    registerRoute(app,
        'tx/:hash',
        {},
        ({params}) => loadRehydrateTx(params.hash))

    registerRoute(app,
        '/tx',
        {method: 'post'},
        async ({body}) => {
            const signer = new Signer(body)
            await signer.init()
            signer.processNewSignatures()
            await signer.saveChanges()
            return signer.toJSON()
        })

}
