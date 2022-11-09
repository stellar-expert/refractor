(async function () {
    process.env.TZ = 'Etc/UTC'

    console.log('Starting up Refractor API')

    const http = require('http'),
        express = require('express'),
        bodyParser = require('body-parser'),
        {port, trustProxy} = require('./app.config'),
        finalizer = require('./business-logic/finalization/finalizer')

    //setup connectors
    console.log('StellarCore DB connection - initialized')
    await require('./storage/storage-layer').initDataProvider()
    console.log('Storage data provider - initialized')
    await finalizer.resetProcessingStatus()
    console.log('Rollback pending actions - done')

    //start background workers
    finalizer.start()

    //init http app
    const app = express()
    app.disable('x-powered-by')
    if (trustProxy) {
        app.set('trust proxy', trustProxy)
    }
    if (process.env.MODE === 'development') {
        const logger = require('morgan')
        app.use(logger('dev'))
    }

    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({extended: false}))
    // error handler
    app.use((err, req, res, next) => {
        if (err) console.error(err)
        res.status(500).end()
    })

    /**
     * Finalize running tasks and close connections
     * @param exitCode
     */
    async function gracefulExit(exitCode = 0) {
        //exit in any case in 10 seconds
        setTimeout(() => {
            console.error('Failed to perform clean exit')
            process.exit(-1)
        }, 5000) //wait max 5 seconds

        await new Promise(resolve => {
            setTimeout(async () => {
                finalizer.stop()
                console.log('Clean exit')
                process.exit(exitCode)
                resolve()
            }, 1000)
        })
    }

    process.on('uncaughtException', async err => {
        console.warn('Fatal error')
        console.error(err)
        await gracefulExit(1)
    })

    process.on('unhandledRejection', async (reason, promise) => {
        console.warn('Fatal error - unhandled promise rejection')
        console.error(`Unhandled Rejection at: ${promise} reason: ${reason.stack || reason}.`)
        await gracefulExit(1)
    })

    process.on('message', msg => msg === 'shutdown' && gracefulExit()) // handle messages from pm2
    process.on('SIGINT', gracefulExit)
    process.on('SIGTERM', gracefulExit)


    //register API routes
    require('./api/api-routes')(app)
    console.log('API routes - initialized')

    const serverPort = parseInt(process.env.PORT || port || '3000')
    app.set('port', serverPort)

    const server = http.createServer(app)

    server.on('listening', () => console.log(`Refractor API server started on ${server.address().port} port`))
    server.listen(serverPort)
})()