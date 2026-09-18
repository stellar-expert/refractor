import {horizonErrorHandler} from '../views/tx/submit/horizon-error-handler'

const fallback = 'Transaction failed'

function txFailed(resultCodes) {
    return {status: 400, title: 'Transaction Failed', extras: {result_codes: resultCodes}}
}

describe('400 Transaction Failed', () => {
    test('maps failing operation codes to descriptions and skips successful operations', () => {
        const err = txFailed({transaction: 'tx_failed', operations: ['op_success', 'op_underfunded', 'op_no_destination']})
        expect(horizonErrorHandler(err, fallback)).toEqual([
            {description: 'Transaction Failed. Insufficient balance to execute this operation'},
            {description: 'Transaction Failed. Destination account was not found'}
        ])
    })

    test('uses the bare title for unknown operation codes', () => {
        const err = txFailed({transaction: 'tx_failed', operations: ['op_unknown_code']})
        expect(horizonErrorHandler(err, fallback)).toEqual([{description: 'Transaction Failed'}])
    })

    test('returns the title when operation details are missing', () => {
        expect(horizonErrorHandler(txFailed({transaction: 'tx_failed'}), fallback)).toEqual([{description: 'Transaction Failed'}])
        expect(horizonErrorHandler(txFailed({transaction: 'tx_failed', operations: []}), fallback)).toEqual([{description: 'Transaction Failed'}])
    })

    test('describes transaction-level result codes', () => {
        expect(horizonErrorHandler(txFailed({transaction: 'tx_bad_seq'}), fallback))
            .toEqual([{description: 'Transaction Failed. Sequence number does not match source account'}])
        expect(horizonErrorHandler(txFailed({transaction: 'tx_too_late'}), fallback))
            .toEqual([{description: 'Transaction Failed. Transaction expired'}])
    })

    test('falls back to the title for unknown transaction codes or missing extras', () => {
        expect(horizonErrorHandler(txFailed({transaction: 'tx_something_new'}), fallback)).toEqual([{description: 'Transaction Failed'}])
        expect(horizonErrorHandler({status: 400, title: 'Transaction Failed'}, fallback)).toEqual([{description: 'Transaction Failed'}])
    })
})

describe('other 400 errors', () => {
    test('returns detail for malformed transactions', () => {
        const err = {status: 400, title: 'Transaction Malformed', detail: 'Unable to parse XDR'}
        expect(horizonErrorHandler(err, fallback)).toEqual([{description: 'Unable to parse XDR'}])
    })

    test('returns reason for bad requests', () => {
        const err = {status: 400, title: 'Bad Request', extras: {reason: 'invalid hash'}}
        expect(horizonErrorHandler(err, fallback)).toEqual([{description: 'invalid hash'}])
    })

    test('falls back to default text for unrecognized 400 titles', () => {
        expect(horizonErrorHandler({status: 400, title: 'Something Else'}, fallback)).toEqual([{description: fallback}])
    })
})

describe('other statuses', () => {
    test('404 returns the title', () => {
        expect(horizonErrorHandler({status: 404, title: 'Resource Missing'}, fallback)).toEqual([{description: 'Resource Missing'}])
    })

    test.each([410, 503, 504])('%i returns the detail', status => {
        expect(horizonErrorHandler({status, detail: 'Try later'}, fallback)).toEqual([{description: 'Try later'}])
    })

    test('unknown status and missing error fall back to default text', () => {
        expect(horizonErrorHandler({status: 500, title: 'Internal'}, fallback)).toEqual([{description: fallback}])
        expect(horizonErrorHandler(undefined, fallback)).toEqual([{description: fallback}])
    })
})
