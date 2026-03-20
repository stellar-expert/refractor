const {standardError} = require('../business-logic/std-error')

test('returns Error with correct message and status', () => {
    const err = standardError(400, 'Bad request')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Bad request')
    expect(err.status).toBe(400)
})

test('works with various status codes', () => {
    expect(standardError(404, 'Not found').status).toBe(404)
    expect(standardError(406, 'Not acceptable').status).toBe(406)
    expect(standardError(500, 'Server error').status).toBe(500)
})

test('stack trace does not reference std-error.js internally', () => {
    const err = standardError(400, 'test')
    // The splice removes the internal standardError frame (from std-error.js),
    // so the stack should not contain a reference to std-error.js
    expect(err.stack).not.toContain('std-error.js')
})
