jest.mock('../infrastructure/tx-dispatcher', () => ({}))

import {Memo} from '@stellar/stellar-sdk'
import {MemoFormatter} from '../views/tx/details/tx-memo-view'
import {hasMemo} from '../views/tx/details/tx-formatted-memo-view'
import {getSignaturesStatus} from '../views/tx/tx-view'
import {buildTx} from './helpers/tx-fixtures'

describe('MemoFormatter', () => {
    test('normalizes numeric and string memo types', () => {
        expect(new MemoFormatter(null, 0).type).toBe('none')
        expect(new MemoFormatter('x', 1).type).toBe('text')
        expect(new MemoFormatter('1', 2).type).toBe('id')
        expect(new MemoFormatter(Buffer.alloc(32), 3).type).toBe('hash')
        expect(new MemoFormatter(Buffer.alloc(32), 4).type).toBe('return')
        expect(new MemoFormatter('x', 'TEXT').type).toBe('text')
    })

    test('throws for unknown memo type', () => {
        expect(() => new MemoFormatter('x', 7)).toThrow('Invalid memo type: 7')
    })

    test('exposes memo presence and binary encodings', () => {
        expect(new MemoFormatter(null, 'none').hasMemo).toBe(false)
        expect(new MemoFormatter('x', 'text').hasMemo).toBe(true)
        expect(new MemoFormatter('x', 'text').isBinary).toBe(false)
        expect(new MemoFormatter('x', 'text').availableEncodings).toEqual([])
        expect(new MemoFormatter(Buffer.alloc(32), 'hash').isBinary).toBe(true)
        expect(new MemoFormatter(Buffer.alloc(32), 'return').availableEncodings).toEqual(['base64', 'hex'])
    })

    test('formats text and id memos as is', () => {
        expect(new MemoFormatter('hello', 'text').format()).toBe('hello')
        expect(new MemoFormatter('12345', 'id').format()).toBe('12345')
    })

    test('shows placeholder for empty memo value', () => {
        expect(new MemoFormatter('', 'text').format()).toBe('[empty]')
        expect(new MemoFormatter(null, 'hash').format('hex')).toBe('[empty]')
    })

    test('encodes binary memos in base64 by default and hex on request', () => {
        const hash = Buffer.from('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20', 'hex')
        const formatter = new MemoFormatter(hash, 'hash')
        expect(formatter.format()).toBe(hash.toString('base64'))
        expect(formatter.format('base64')).toBe(hash.toString('base64'))
        expect(formatter.format('hex')).toBe('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20')
    })

    test('rejects unsupported encoding', () => {
        expect(() => new MemoFormatter(Buffer.alloc(32), 'hash').format('utf8')).toThrow('Not supported memo encoding: utf8')
    })
})

describe('hasMemo', () => {
    test('is false for transactions without memo', () => {
        expect(hasMemo(buildTx())).toBeFalsy()
    })

    test('is true for transactions with memo', () => {
        expect(hasMemo(buildTx({memo: Memo.text('hi')}))).toBeTruthy()
        expect(hasMemo(buildTx({memo: Memo.id('42')}))).toBeTruthy()
    })
})

describe('getSignaturesStatus', () => {
    const [a, b, c] = ['GA_SIGNER_A', 'GB_SIGNER_B', 'GC_SIGNER_C']
    const singleRequirement = {
        requirements: [{minThreshold: 2, signers: [{key: a, weight: 1}, {key: b, weight: 2}, {key: c, weight: 1}]}]
    }
    const multiRequirement = {
        requirements: [
            {minThreshold: 1, signers: [{key: a, weight: 1}]},
            {minThreshold: 1, signers: [{key: b, weight: 1}]}
        ]
    }

    test('returns empty string without signatures or schema', () => {
        expect(getSignaturesStatus({signatures: [], schema: singleRequirement})).toBe('')
        expect(getSignaturesStatus({signatures: [{key: a}], schema: null})).toBe('')
        expect(getSignaturesStatus({signatures: [{key: a}], schema: {}})).toBe('')
    })

    test('summarizes weighted progress for a single requirement and annotates signature weights', () => {
        const signatures = [{key: a}]
        expect(getSignaturesStatus({readyToSubmit: false, signatures, schema: singleRequirement})).toBe('1/2 of 4 possible')
        expect(signatures[0].weight).toBe(1)
    })

    test('marks fully signed single requirement', () => {
        const signatures = [{key: a}, {key: b}]
        expect(getSignaturesStatus({readyToSubmit: true, signatures, schema: singleRequirement})).toBe('✓ 2/2 of 4 possible')
        expect(signatures[1].weight).toBe(2)
    })

    test('counts signatures from keys outside the schema without assigning weight', () => {
        const signatures = [{key: 'GX_OTHER'}]
        expect(getSignaturesStatus({readyToSubmit: false, signatures, schema: singleRequirement})).toBe('1/2 of 4 possible')
        expect(signatures[0].weight).toBeUndefined()
    })

    test('reports generic status for multi-requirement schemas', () => {
        expect(getSignaturesStatus({readyToSubmit: false, signatures: [{key: a}], schema: multiRequirement})).toBe('more signatures required')
        expect(getSignaturesStatus({readyToSubmit: true, signatures: [{key: a}, {key: b}], schema: multiRequirement})).toBe('✓ fully signed')
    })
})
