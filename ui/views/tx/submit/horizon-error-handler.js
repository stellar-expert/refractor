
import resultCodesDescription from './result-codes-description.js'

function handleOperationError(operations, defaultErrorText) {
    if (!operations?.length)
        return [{'description': defaultErrorText}]
    const errors = operations.reduce((acc, op) => {
        const moreDetail = (resultCodesDescription[op]) ? `${defaultErrorText}. ${resultCodesDescription[op]}` : defaultErrorText
        acc.push({'description': moreDetail})
        return acc
    }, [])
    return errors
}

function handleTransactionError(err) {
    const resultCodes = err?.extras?.result_codes
    switch (resultCodes?.transaction){
    case ('tx_failed'):
        return handleOperationError(resultCodes?.operations, err?.title)
    default:
        if (resultCodesDescription[resultCodes?.transaction])
            return [{
                description: `${err?.title}. ${resultCodesDescription[resultCodes?.transaction]}`
            }]
    }
    return [{'description': err?.title}]
}

export function horizonErrorHandler(err, defaultErrorText) {
    switch (err?.status) {
    case 404:
        return [{'description': err?.title}]
    case 400:
        if (err?.title === 'Transaction Failed') {
            return handleTransactionError(err)
        }
        if (err?.title === 'Transaction Malformed') {
            return [{'description': err?.detail}]
        }
        if (err?.title === 'Bad Request') {
            return [{'description': err?.extras.reason}]
        }
        return [{'description': defaultErrorText}]
    case 410:
    case 503:
    case 504:
        return [{'description': err?.detail}]
    default:
        return [{'description': defaultErrorText}]
    }
}