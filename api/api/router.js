const cors = require('cors'),
    rateLimit = require('express-rate-limit')

const defaultCorsOptions = {
    optionsSuccessStatus: 200,
    origin: function (origin, callback) {
        callback(null, true) // allow all origins for now
    }
}

const rateLimits = {
    general: rateLimit({
        windowMs: 60 * 1000, // max 120 requests per minute
        max: 120
    }),
    strict: rateLimit({ // max 10 requests per minute
        windowMs: 60 * 1000,
        max: 10
    })
}

function processResponse(res, promise, headers, prettyPrint = false) {
    if (typeof promise.then !== 'function') {
        promise = Promise.resolve(promise)
    }
    promise
        .then(data => {
            if (!data) data = {}
            if (headers) {
                res.set(headers)
                //send raw data if content-type was specified
                if (headers['content-type'] && headers['content-type'] !== 'application/json') {
                    res.send(data)
                    return
                }
            }
            if (prettyPrint) { //pretty-print result (tabs)
                res.set({'content-type': 'application/json'})
                res.send(JSON.stringify(data, null, '  '))
            } else {
                res.json(data)
            }
        })
        .catch(err => {
            if (err.status) {
                return res.status(err.status).json({error: err.message, status: err.status})
            }
            //unhandled error
            console.error(err)
            res.status(500).json({error: 'Internal server error', status: 500})
        })
}


module.exports = {
    /**
     * Register API route.
     * @param {object} app - Express app instance.
     * @param {string} route - Relative route path.
     * @param {object} options - Additional options.
     * @param {'get'|'post'} [options.method] - Route method. Default: 'get'
     * @param {'general'|'strict'} [options.rate] - Rate limiting rules. Default: 'general'
     * @param {object} [options.headers] - Additional response headers. Default: {}.
     * @param {routeHandler} handler - Request handler.
     */
    registerRoute(app, route, options, handler) {
        const {method = 'get', rate = 'general', headers} = options
        //middleware - CORS and rate limiting
        const corsMiddleware = cors({...defaultCorsOptions})
        //normalize route
        if (route.indexOf('/') !== 0) {
            route = '/' + route
        }
        //register request handler
        app[method.toLowerCase()](route, [corsMiddleware, rateLimits[rate]], function (req, res) {
            processResponse(res, handler(req), headers, req.query && req.query.prettyPrint !== undefined)
        })
        //register pre-flight request handler
        if (method.toLowerCase() !== 'get') {
            app.options(route, [corsMiddleware], function (req, res) {
                res.text(method.toUpperCase())
            })
        }
    }

    /**
     * Route handler callback.
     * @callback routeHandler
     * @param {{params: object, query: object, path: string}} req - Request object.
     */
}