const {registerRoute} = require('../api/router')

function mockRes() {
    const res = {
        json: jest.fn(),
        send: jest.fn(),
        set: jest.fn(),
        status: jest.fn()
    }
    res.status.mockReturnValue(res)
    return res
}

describe('processResponse (via registerRoute)', () => {
    let app, handler, registeredHandler

    beforeEach(() => {
        app = {
            get: jest.fn(),
            post: jest.fn(),
            options: jest.fn()
        }
    })

    function captureHandler(method = 'get') {
        registerRoute(app, '/test', {method}, handler)
        const call = app[method].mock.calls[0]
        // handler is the callback at the end: app.get(route, [middleware], handler)
        return call[call.length - 1]
    }

    test('registers GET route by default', () => {
        handler = jest.fn(() => ({}))
        registerRoute(app, '/test', {}, handler)
        expect(app.get).toHaveBeenCalled()
    })

    test('registers POST route and OPTIONS pre-flight', () => {
        handler = jest.fn(() => ({}))
        registerRoute(app, '/test', {method: 'post'}, handler)
        expect(app.post).toHaveBeenCalled()
        expect(app.options).toHaveBeenCalled()
    })

    test('normalizes route without leading slash', () => {
        handler = jest.fn(() => ({}))
        registerRoute(app, 'test', {}, handler)
        expect(app.get.mock.calls[0][0]).toBe('/test')
    })

    test('sends JSON response for resolved promise', async () => {
        handler = jest.fn(() => Promise.resolve({foo: 'bar'}))
        const routeHandler = captureHandler()
        const res = mockRes()
        routeHandler({query: {}}, res)
        await new Promise(r => setTimeout(r, 0))
        expect(res.json).toHaveBeenCalledWith({foo: 'bar'})
    })

    test('sends error with status for errors with .status property', async () => {
        const err = new Error('Bad request')
        err.status = 400
        handler = jest.fn(() => Promise.reject(err))
        const routeHandler = captureHandler()
        const res = mockRes()
        routeHandler({query: {}}, res)
        await new Promise(r => setTimeout(r, 0))
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({error: 'Bad request', status: 400})
    })

    test('sends 500 for unhandled errors', async () => {
        handler = jest.fn(() => Promise.reject(new Error('unexpected')))
        const routeHandler = captureHandler()
        const res = mockRes()
        routeHandler({query: {}}, res)
        await new Promise(r => setTimeout(r, 0))
        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({error: 'Internal server error', status: 500})
    })

    test('handles non-promise return values', async () => {
        handler = jest.fn(() => ({sync: true}))
        const routeHandler = captureHandler()
        const res = mockRes()
        routeHandler({query: {}}, res)
        await new Promise(r => setTimeout(r, 0))
        expect(res.json).toHaveBeenCalledWith({sync: true})
    })

    test('pretty-prints when prettyPrint query param is present', async () => {
        handler = jest.fn(() => Promise.resolve({a: 1}))
        const routeHandler = captureHandler()
        const res = mockRes()
        routeHandler({query: {prettyPrint: ''}}, res)
        await new Promise(r => setTimeout(r, 0))
        expect(res.set).toHaveBeenCalledWith({'content-type': 'application/json'})
        expect(res.send).toHaveBeenCalledWith(JSON.stringify({a: 1}, null, '  '))
    })

    test('sets custom headers', async () => {
        handler = jest.fn(() => Promise.resolve({data: 1}))
        registerRoute(app, '/h', {headers: {'x-custom': 'val'}}, handler)
        const call = app.get.mock.calls[0]
        const routeHandler = call[call.length - 1]
        const res = mockRes()
        routeHandler({query: {}}, res)
        await new Promise(r => setTimeout(r, 0))
        expect(res.set).toHaveBeenCalledWith({'x-custom': 'val'})
    })
})
