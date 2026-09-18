import {apiCall} from '../infrastructure/api'

function mockResponse(body, {ok = true, status = 200, statusText = 'OK', validJson = true} = {}) {
    return {
        ok,
        status,
        statusText,
        json: () => validJson ? Promise.resolve(body) : Promise.reject(new SyntaxError('Unexpected token'))
    }
}

test('GET request appends the sorted query string to the API origin', async () => {
    fetch.mockResolvedValue(mockResponse({hash: 'abc'}))
    const res = await apiCall('tx/abc', {network: 'public', cursor: '10'})
    expect(fetch).toHaveBeenCalledWith('https://api.refractor.test/tx/abc?cursor=10&network=public', {})
    expect(res).toEqual({hash: 'abc'})
})

test('GET request without data has no query string', async () => {
    fetch.mockResolvedValue(mockResponse({}))
    await apiCall('tx/abc')
    expect(fetch).toHaveBeenCalledWith('https://api.refractor.test/tx/abc', {})
})

test('POST request sends JSON payload with proper headers', async () => {
    fetch.mockResolvedValue(mockResponse({hash: 'abc'}))
    const payload = {network: 'public', xdr: 'AAAA'}
    await apiCall('tx', payload, {method: 'POST'})
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, params] = fetch.mock.calls[0]
    expect(url).toBe('https://api.refractor.test/tx')
    expect(params.method).toBe('POST')
    expect(params.body).toBe(JSON.stringify(payload))
    expect(params.headers).toEqual({
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
    })
})

test('rejects with the server-provided error message and status', async () => {
    fetch.mockResolvedValue(mockResponse({error: 'Invalid transaction XDR'}, {ok: false, status: 400, statusText: 'Bad Request'}))
    await expect(apiCall('tx', {}, {method: 'POST'})).rejects.toMatchObject({
        message: 'Invalid transaction XDR',
        status: 400,
        error: 'Bad Request',
        ext: {error: 'Invalid transaction XDR'}
    })
})

test('falls back to status text when the error body is not JSON', async () => {
    fetch.mockResolvedValue(mockResponse(null, {ok: false, status: 404, statusText: 'Not Found', validJson: false}))
    await expect(apiCall('tx/unknown')).rejects.toMatchObject({message: 'Not Found', status: 404, ext: {}})
})

test('propagates network failures', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiCall('tx/abc')).rejects.toThrow('Failed to fetch')
})
