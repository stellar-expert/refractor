import {parseQuery, stringifyQuery} from '../infrastructure/url-utils'

describe('stringifyQuery', () => {
    test('returns empty string when there is nothing to serialize', () => {
        expect(stringifyQuery()).toBe('')
        expect(stringifyQuery({})).toBe('')
        expect(stringifyQuery({a: undefined, b: null, c: ''})).toBe('')
    })

    test('sorts keys and encodes values', () => {
        expect(stringifyQuery({b: 'x y', a: 1, c: 'a&b'})).toBe('?a=1&b=x%20y&c=a%26b')
    })

    test('serializes arrays as repeated key[] params', () => {
        expect(stringifyQuery({tag: ['dex', 'amm']})).toBe('?tag[]=dex&tag[]=amm')
    })

    test('keeps zero and false values', () => {
        expect(stringifyQuery({limit: 0, submit: false})).toBe('?limit=0&submit=false')
    })
})

describe('parseQuery', () => {
    test('parses query string with or without leading question mark', () => {
        expect(parseQuery('?a=1&b=x%20y')).toEqual({a: '1', b: 'x y'})
        expect(parseQuery('a=1')).toEqual({a: '1'})
    })

    test('collects key[] params into arrays', () => {
        expect(parseQuery('tag[]=dex&tag[]=amm&x=1')).toEqual({tag: ['dex', 'amm'], x: '1'})
    })

    test('returns empty object for empty query', () => {
        expect(parseQuery('')).toEqual({})
        expect(parseQuery('?')).toEqual({})
    })

    test('reads the current location by default', () => {
        window.history.replaceState(null, '', '/tx/add?network=testnet')
        expect(parseQuery()).toEqual({network: 'testnet'})
    })

    test('merges into the provided destination object', () => {
        const dest = {existing: true}
        expect(parseQuery('a=1', dest)).toBe(dest)
        expect(dest).toEqual({existing: true, a: '1'})
    })

    test('round-trips with stringifyQuery', () => {
        const query = {network: 'public', tag: ['a', 'b'], q: 'x y'}
        expect(parseQuery(stringifyQuery(query))).toEqual(query)
    })
})
