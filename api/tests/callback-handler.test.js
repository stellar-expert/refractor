const {processCallback, setCallbackHandler} = require('../business-logic/finalization/callback-handler')

let mockHandler

beforeEach(() => {
    mockHandler = jest.fn()
    setCallbackHandler(mockHandler)
})

test('throws when callbackUrl is missing', async () => {
    await expect(processCallback({hash: 'abc'})).rejects.toThrow('empty callback')
})

test('returns immediately on first 200 response', async () => {
    mockHandler.mockResolvedValue({status: 200})
    await processCallback({callbackUrl: 'http://example.com', hash: 'abc'})
    expect(mockHandler).toHaveBeenCalledTimes(1)
})

test('retries on non-200 and eventually throws', async () => {
    jest.useFakeTimers()
    mockHandler.mockResolvedValue({status: 500})

    const promise = processCallback({callbackUrl: 'http://example.com', hash: 'abc'})

    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const resultPromise = expect(promise).rejects.toThrow('invalid status code')

    await jest.runAllTimersAsync()
    await resultPromise

    expect(mockHandler).toHaveBeenCalledTimes(9)
    jest.useRealTimers()
})

test('succeeds on retry after initial failures', async () => {
    mockHandler
        .mockResolvedValueOnce({status: 500})
        .mockResolvedValueOnce({status: 500})
        .mockResolvedValueOnce({status: 200})

    await processCallback({callbackUrl: 'http://example.com', hash: 'abc'})
    expect(mockHandler).toHaveBeenCalledTimes(3)
})
